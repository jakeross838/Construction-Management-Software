-- Migration 108: Cash Flow & Forecasting
-- Track cash inflows, outflows, and project future cash position

-- ============================================================
-- CASH FLOW ENTRIES
-- Manual and automatic cash flow entries
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_cash_flow_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL, -- inflow, outflow

  -- Classification
  category TEXT NOT NULL, -- draws, invoice_payments, payroll, overhead, other
  subcategory TEXT,

  -- Amount
  amount DECIMAL(14,2) NOT NULL,

  -- Reference
  job_id UUID REFERENCES v2_jobs(id),
  draw_id UUID REFERENCES v2_draws(id),
  invoice_id UUID REFERENCES v2_invoices(id),
  vendor_id UUID REFERENCES v2_vendors(id),

  -- Details
  description TEXT,
  reference_number TEXT,

  -- Timing
  is_projected BOOLEAN DEFAULT FALSE, -- TRUE for forecasts
  actual_date DATE, -- When actually received/paid
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT, -- weekly, biweekly, monthly

  -- Status
  status TEXT DEFAULT 'pending', -- pending, confirmed, received/paid, cancelled

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- CASH FLOW FORECASTS
-- Weekly/Monthly cash flow projections
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_cash_flow_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL, -- weekly, monthly

  -- Opening
  opening_balance DECIMAL(14,2) DEFAULT 0,

  -- Inflows
  projected_draw_receipts DECIMAL(14,2) DEFAULT 0,
  projected_other_inflows DECIMAL(14,2) DEFAULT 0,
  total_projected_inflows DECIMAL(14,2) DEFAULT 0,

  -- Outflows
  projected_vendor_payments DECIMAL(14,2) DEFAULT 0,
  projected_payroll DECIMAL(14,2) DEFAULT 0,
  projected_overhead DECIMAL(14,2) DEFAULT 0,
  projected_other_outflows DECIMAL(14,2) DEFAULT 0,
  total_projected_outflows DECIMAL(14,2) DEFAULT 0,

  -- Net
  net_cash_flow DECIMAL(14,2) DEFAULT 0,
  closing_balance DECIMAL(14,2) DEFAULT 0,

  -- Actual (updated after period closes)
  actual_inflows DECIMAL(14,2),
  actual_outflows DECIMAL(14,2),
  actual_net DECIMAL(14,2),
  actual_closing DECIMAL(14,2),

  -- Variance
  variance_amount DECIMAL(14,2),
  variance_percent DECIMAL(6,4),

  -- Status
  status TEXT DEFAULT 'forecast', -- forecast, in_progress, closed

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(period_start, period_type)
);

-- ============================================================
-- PAYMENT SCHEDULES
-- Schedule of expected payments
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  schedule_type TEXT NOT NULL, -- receivable, payable
  due_date DATE NOT NULL,

  -- Reference
  job_id UUID REFERENCES v2_jobs(id),
  draw_id UUID REFERENCES v2_draws(id),
  invoice_id UUID REFERENCES v2_invoices(id),
  vendor_id UUID REFERENCES v2_vendors(id),

  -- Amount
  expected_amount DECIMAL(14,2) NOT NULL,
  received_amount DECIMAL(14,2) DEFAULT 0,
  remaining_amount DECIMAL(14,2),

  -- Status
  status TEXT DEFAULT 'pending', -- pending, partial, complete, overdue

  -- Details
  description TEXT,
  payment_terms INTEGER, -- days

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON v2_cash_flow_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_type ON v2_cash_flow_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_cash_flow_category ON v2_cash_flow_entries(category);
CREATE INDEX IF NOT EXISTS idx_cash_flow_job ON v2_cash_flow_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_status ON v2_cash_flow_entries(status);
CREATE INDEX IF NOT EXISTS idx_forecast_period ON v2_cash_flow_forecasts(period_start);
CREATE INDEX IF NOT EXISTS idx_payment_due ON v2_payment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_status ON v2_payment_schedules(status);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Calculate projected cash flows for a date range
CREATE OR REPLACE FUNCTION calculate_cash_flow_projection(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  projected_draw_receipts DECIMAL(14,2),
  projected_vendor_payments DECIMAL(14,2),
  projected_payroll DECIMAL(14,2),
  projected_overhead DECIMAL(14,2),
  total_inflows DECIMAL(14,2),
  total_outflows DECIMAL(14,2),
  net_cash_flow DECIMAL(14,2)
) AS $$
DECLARE
  v_draws DECIMAL(14,2) := 0;
  v_vendor DECIMAL(14,2) := 0;
  v_payroll DECIMAL(14,2) := 0;
  v_overhead DECIMAL(14,2) := 0;
  v_in DECIMAL(14,2);
  v_out DECIMAL(14,2);
BEGIN
  -- Projected draw receipts (submitted draws)
  SELECT COALESCE(SUM(d.total_amount), 0) INTO v_draws
  FROM v2_draws d
  WHERE d.status = 'submitted'
    AND d.submitted_at >= p_start_date
    AND d.submitted_at <= p_end_date + INTERVAL '30 days'; -- Assume 30 day payment

  -- Projected vendor payments (approved invoices not yet paid)
  SELECT COALESCE(SUM(i.amount), 0) INTO v_vendor
  FROM v2_invoices i
  WHERE i.status IN ('approved', 'in_draw')
    AND i.due_date >= p_start_date
    AND i.due_date <= p_end_date
    AND i.deleted_at IS NULL;

  -- Projected payroll from timesheets
  SELECT COALESCE(SUM(t.total_cost), 0) INTO v_payroll
  FROM v2_timesheets t
  WHERE t.status = 'approved'
    AND t.work_date >= p_start_date - INTERVAL '14 days' -- Biweekly lag
    AND t.work_date <= p_end_date
    AND t.deleted_at IS NULL;

  -- Projected overhead from expenses
  SELECT COALESCE(SUM(e.amount), 0) INTO v_overhead
  FROM v2_expenses e
  WHERE e.expense_type = 'indirect'
    AND e.expense_date >= p_start_date
    AND e.expense_date <= p_end_date
    AND e.deleted_at IS NULL;

  v_in := v_draws;
  v_out := v_vendor + v_payroll + v_overhead;

  RETURN QUERY SELECT
    v_draws, v_vendor, v_payroll, v_overhead,
    v_in, v_out, v_in - v_out;
END;
$$ LANGUAGE plpgsql;

-- Get cash position as of a date
CREATE OR REPLACE FUNCTION get_cash_position(p_as_of_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_receivables DECIMAL(14,2),
  total_payables DECIMAL(14,2),
  overdue_receivables DECIMAL(14,2),
  overdue_payables DECIMAL(14,2),
  submitted_draws DECIMAL(14,2),
  pending_payments DECIMAL(14,2)
) AS $$
DECLARE
  v_receivables DECIMAL(14,2) := 0;
  v_payables DECIMAL(14,2) := 0;
  v_overdue_recv DECIMAL(14,2) := 0;
  v_overdue_pay DECIMAL(14,2) := 0;
  v_draws DECIMAL(14,2) := 0;
  v_pending DECIMAL(14,2) := 0;
BEGIN
  -- Total receivables (submitted draws)
  SELECT COALESCE(SUM(d.total_amount), 0) INTO v_receivables
  FROM v2_draws d WHERE d.status = 'submitted';

  -- Total payables (approved unpaid invoices)
  SELECT COALESCE(SUM(i.amount), 0) INTO v_payables
  FROM v2_invoices i
  WHERE i.status IN ('approved', 'in_draw')
    AND i.deleted_at IS NULL;

  -- Overdue receivables (draws submitted > 30 days ago)
  SELECT COALESCE(SUM(d.total_amount), 0) INTO v_overdue_recv
  FROM v2_draws d
  WHERE d.status = 'submitted'
    AND d.submitted_at < p_as_of_date - INTERVAL '30 days';

  -- Overdue payables
  SELECT COALESCE(SUM(i.amount), 0) INTO v_overdue_pay
  FROM v2_invoices i
  WHERE i.status IN ('approved', 'in_draw')
    AND i.due_date < p_as_of_date
    AND i.deleted_at IS NULL;

  v_draws := v_receivables;
  v_pending := v_payables;

  RETURN QUERY SELECT
    v_receivables, v_payables, v_overdue_recv, v_overdue_pay,
    v_draws, v_pending;
END;
$$ LANGUAGE plpgsql;

-- Create weekly cash flow forecast
CREATE OR REPLACE FUNCTION create_weekly_forecast(
  p_start_date DATE,
  p_weeks INTEGER DEFAULT 12,
  p_opening_balance DECIMAL(14,2) DEFAULT 0
)
RETURNS SETOF v2_cash_flow_forecasts AS $$
DECLARE
  v_week_start DATE := p_start_date;
  v_week_end DATE;
  v_balance DECIMAL(14,2) := p_opening_balance;
  v_projection RECORD;
  v_forecast v2_cash_flow_forecasts%ROWTYPE;
BEGIN
  FOR i IN 1..p_weeks LOOP
    v_week_end := v_week_start + INTERVAL '6 days';

    -- Get projection for this week
    SELECT * INTO v_projection FROM calculate_cash_flow_projection(v_week_start, v_week_end);

    -- Insert or update forecast
    INSERT INTO v2_cash_flow_forecasts (
      period_start, period_end, period_type,
      opening_balance,
      projected_draw_receipts, projected_other_inflows, total_projected_inflows,
      projected_vendor_payments, projected_payroll, projected_overhead, projected_other_outflows, total_projected_outflows,
      net_cash_flow, closing_balance,
      status
    ) VALUES (
      v_week_start, v_week_end, 'weekly',
      v_balance,
      v_projection.projected_draw_receipts, 0, v_projection.total_inflows,
      v_projection.projected_vendor_payments, v_projection.projected_payroll, v_projection.projected_overhead, 0, v_projection.total_outflows,
      v_projection.net_cash_flow, v_balance + v_projection.net_cash_flow,
      CASE WHEN v_week_start <= CURRENT_DATE THEN 'in_progress' ELSE 'forecast' END
    )
    ON CONFLICT (period_start, period_type)
    DO UPDATE SET
      projected_draw_receipts = EXCLUDED.projected_draw_receipts,
      total_projected_inflows = EXCLUDED.total_projected_inflows,
      projected_vendor_payments = EXCLUDED.projected_vendor_payments,
      projected_payroll = EXCLUDED.projected_payroll,
      projected_overhead = EXCLUDED.projected_overhead,
      total_projected_outflows = EXCLUDED.total_projected_outflows,
      net_cash_flow = EXCLUDED.net_cash_flow,
      opening_balance = EXCLUDED.opening_balance,
      closing_balance = EXCLUDED.closing_balance,
      updated_at = NOW()
    RETURNING * INTO v_forecast;

    -- Update balance for next week
    v_balance := v_forecast.closing_balance;

    -- Move to next week
    v_week_start := v_week_start + INTERVAL '7 days';

    RETURN NEXT v_forecast;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS
-- ============================================================

-- Current cash position
CREATE OR REPLACE VIEW v2_cash_position_current AS
SELECT * FROM get_cash_position(CURRENT_DATE);

-- Upcoming payments (next 30 days)
CREATE OR REPLACE VIEW v2_upcoming_payments AS
SELECT
  i.id as invoice_id,
  i.invoice_number,
  i.amount,
  i.due_date,
  v.name as vendor_name,
  j.name as job_name,
  CASE WHEN i.due_date < CURRENT_DATE THEN 'overdue'
       WHEN i.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
       ELSE 'upcoming' END as urgency
FROM v2_invoices i
JOIN v2_vendors v ON v.id = i.vendor_id
LEFT JOIN v2_jobs j ON j.id = i.job_id
WHERE i.status IN ('approved', 'in_draw')
  AND i.due_date <= CURRENT_DATE + INTERVAL '30 days'
  AND i.deleted_at IS NULL
ORDER BY i.due_date;

-- Expected receipts
CREATE OR REPLACE VIEW v2_expected_receipts AS
SELECT
  d.id as draw_id,
  d.draw_number,
  d.total_amount,
  d.submitted_at,
  d.submitted_at + INTERVAL '30 days' as expected_date,
  j.name as job_name,
  j.client_name
FROM v2_draws d
JOIN v2_jobs j ON j.id = d.job_id
WHERE d.status = 'submitted'
ORDER BY d.submitted_at;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_cash_flow_entries IS 'Individual cash flow transactions';
COMMENT ON TABLE v2_cash_flow_forecasts IS 'Weekly/monthly cash flow projections';
COMMENT ON TABLE v2_payment_schedules IS 'Schedule of expected payments';
COMMENT ON FUNCTION calculate_cash_flow_projection(DATE, DATE) IS 'Calculate projected cash flows for a date range';
COMMENT ON FUNCTION create_weekly_forecast(DATE, INTEGER, DECIMAL) IS 'Generate weekly cash flow forecast';
