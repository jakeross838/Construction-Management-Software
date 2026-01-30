-- Migration 101: Expense Tracking Enhancements
-- Recurring expenses and receipt handling for v3.1

-- ============================================================
-- RECURRING EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template data
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES v2_expense_categories(id),
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,

  -- Schedule
  frequency TEXT NOT NULL DEFAULT 'monthly', -- monthly, weekly, quarterly, annual
  day_of_month INTEGER DEFAULT 1,            -- 1-28 for monthly

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  next_occurrence DATE,
  last_created_at TIMESTAMPTZ,

  -- Audit
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_day_of_month CHECK (day_of_month >= 1 AND day_of_month <= 28)
);

-- ============================================================
-- EXPENSE RECEIPTS TABLE (for multiple receipts per expense)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_expense_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES v2_expenses(id) ON DELETE CASCADE,

  -- File info
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,           -- image/jpeg, image/png, application/pdf
  file_size INTEGER,        -- bytes

  -- Audit
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active
  ON v2_recurring_expenses(is_active, next_occurrence)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_receipts_expense
  ON v2_expense_receipts(expense_id);

-- ============================================================
-- TRIGGER: Auto-update recurring expense timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_recurring_expense_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_recurring_expense_timestamp ON v2_recurring_expenses;
CREATE TRIGGER set_recurring_expense_timestamp
  BEFORE UPDATE ON v2_recurring_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_expense_timestamp();

-- ============================================================
-- FUNCTION: Process recurring expenses
-- Creates expenses from active recurring templates where due
-- ============================================================

CREATE OR REPLACE FUNCTION process_recurring_expenses()
RETURNS INTEGER AS $$
DECLARE
  rec RECORD;
  created_count INTEGER := 0;
  new_expense_id UUID;
BEGIN
  FOR rec IN
    SELECT * FROM v2_recurring_expenses
    WHERE is_active = TRUE
      AND deleted_at IS NULL
      AND (next_occurrence IS NULL OR next_occurrence <= CURRENT_DATE)
  LOOP
    -- Create expense from template
    INSERT INTO v2_expenses (
      amount, description, expense_date, category_id, vendor_id,
      notes, created_by
    ) VALUES (
      rec.amount,
      rec.description,
      COALESCE(rec.next_occurrence, CURRENT_DATE),
      rec.category_id,
      rec.vendor_id,
      'Auto-created from recurring expense',
      rec.created_by
    ) RETURNING id INTO new_expense_id;

    -- Update recurring expense with next occurrence
    UPDATE v2_recurring_expenses
    SET
      last_created_at = NOW(),
      next_occurrence = CASE
        WHEN frequency = 'monthly' THEN
          (COALESCE(next_occurrence, CURRENT_DATE) + INTERVAL '1 month')::DATE
        WHEN frequency = 'weekly' THEN
          (COALESCE(next_occurrence, CURRENT_DATE) + INTERVAL '1 week')::DATE
        WHEN frequency = 'quarterly' THEN
          (COALESCE(next_occurrence, CURRENT_DATE) + INTERVAL '3 months')::DATE
        WHEN frequency = 'annual' THEN
          (COALESCE(next_occurrence, CURRENT_DATE) + INTERVAL '1 year')::DATE
        ELSE
          (COALESCE(next_occurrence, CURRENT_DATE) + INTERVAL '1 month')::DATE
      END
    WHERE id = rec.id;

    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_recurring_expenses IS 'Templates for automatically creating recurring overhead expenses';
COMMENT ON TABLE v2_expense_receipts IS 'Receipt attachments for expenses';
COMMENT ON COLUMN v2_recurring_expenses.day_of_month IS 'Day to create expense (1-28 to avoid end-of-month issues)';
COMMENT ON FUNCTION process_recurring_expenses() IS 'Call periodically to create expenses from due recurring templates';
