-- Migration 175: Fix budget sync trigger to include budget_id
-- The sync_budget_from_allocations function was missing the budget_id field
-- when inserting into v2_budget_lines, causing NOT NULL constraint violations.

CREATE OR REPLACE FUNCTION public.sync_budget_from_allocations(p_job_id uuid, p_cost_code_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_billed DECIMAL(12,2) := 0;
  v_paid DECIMAL(12,2) := 0;
  v_budget_id uuid;
BEGIN
  -- Get the budget_id for this job
  SELECT id INTO v_budget_id
  FROM v2_budgets
  WHERE job_id = p_job_id
  LIMIT 1;

  -- If no budget exists, skip the sync (budget will be created later)
  IF v_budget_id IS NULL THEN
    RETURN;
  END IF;

  -- Calculate billed (in_draw status)
  SELECT COALESCE(SUM(a.amount), 0) INTO v_billed
  FROM v2_invoice_allocations a
  JOIN v2_invoices i ON a.invoice_id = i.id
  WHERE a.job_id = p_job_id
    AND a.cost_code_id = p_cost_code_id
    AND i.status = 'in_draw'
    AND i.deleted_at IS NULL;

  -- Calculate paid
  SELECT COALESCE(SUM(a.amount), 0) INTO v_paid
  FROM v2_invoice_allocations a
  JOIN v2_invoices i ON a.invoice_id = i.id
  WHERE a.job_id = p_job_id
    AND a.cost_code_id = p_cost_code_id
    AND i.status = 'paid'
    AND i.deleted_at IS NULL;

  -- Update or insert budget line (now includes budget_id)
  INSERT INTO v2_budget_lines (budget_id, job_id, cost_code_id, budgeted_amount, committed_amount, billed_amount, paid_amount)
  VALUES (v_budget_id, p_job_id, p_cost_code_id, 0, 0, v_billed, v_paid)
  ON CONFLICT (job_id, cost_code_id)
  DO UPDATE SET
    billed_amount = v_billed,
    paid_amount = v_paid;
END;
$function$;
