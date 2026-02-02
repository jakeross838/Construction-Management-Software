-- Migration 151: Accounts Receivable Module
-- Client invoicing and payment tracking for draws

-- ============================================================
-- CLIENT INVOICES (AR - What clients owe the builder)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_client_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  client_id UUID REFERENCES v2_clients(id) ON DELETE SET NULL,
  draw_id UUID REFERENCES v2_draws(id) ON DELETE SET NULL,

  -- Invoice details
  invoice_number TEXT NOT NULL,
  description TEXT,

  -- Amounts
  amount DECIMAL(12,2) NOT NULL,
  retainage_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (amount + COALESCE(tax_amount, 0) - COALESCE(retainage_amount, 0)) STORED,

  -- Payment tracking
  paid_amount DECIMAL(12,2) DEFAULT 0,
  balance_due DECIMAL(12,2) GENERATED ALWAYS AS (amount + COALESCE(tax_amount, 0) - COALESCE(retainage_amount, 0) - COALESCE(paid_amount, 0)) STORED,

  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,

  -- Status: draft, sent, partial, paid, overdue, void
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue', 'void')),

  -- Reference info
  terms TEXT, -- e.g., "Net 30"
  notes TEXT,

  -- PDF storage
  pdf_url TEXT,

  -- Metadata
  created_by TEXT,
  sent_at TIMESTAMPTZ,
  sent_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(builder_id, invoice_number)
);

-- ============================================================
-- CLIENT PAYMENTS (Payments received from clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_client_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  client_invoice_id UUID REFERENCES v2_client_invoices(id) ON DELETE CASCADE,

  -- Payment details
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Payment method: check, wire, ach, credit_card, cash, other
  payment_method TEXT DEFAULT 'check' CHECK (payment_method IN ('check', 'wire', 'ach', 'credit_card', 'cash', 'other')),
  reference_number TEXT, -- Check #, transaction ID, etc.

  -- Metadata
  notes TEXT,
  received_by TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- CLIENT INVOICE ACTIVITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_client_invoice_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_invoice_id UUID REFERENCES v2_client_invoices(id) ON DELETE CASCADE,

  action TEXT NOT NULL, -- created, sent, payment_received, voided, etc.
  performed_by TEXT,
  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_client_invoices_builder ON v2_client_invoices(builder_id);
CREATE INDEX IF NOT EXISTS idx_v2_client_invoices_job ON v2_client_invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_client_invoices_client ON v2_client_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_v2_client_invoices_draw ON v2_client_invoices(draw_id);
CREATE INDEX IF NOT EXISTS idx_v2_client_invoices_status ON v2_client_invoices(status);
CREATE INDEX IF NOT EXISTS idx_v2_client_invoices_due_date ON v2_client_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_v2_client_invoices_deleted ON v2_client_invoices(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_v2_client_payments_invoice ON v2_client_payments(client_invoice_id);
CREATE INDEX IF NOT EXISTS idx_v2_client_payments_builder ON v2_client_payments(builder_id);
CREATE INDEX IF NOT EXISTS idx_v2_client_payments_date ON v2_client_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_v2_client_invoice_activity_invoice ON v2_client_invoice_activity(client_invoice_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Update updated_at on client invoices
CREATE OR REPLACE FUNCTION update_client_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_client_invoice_updated_at ON v2_client_invoices;
CREATE TRIGGER trigger_client_invoice_updated_at
  BEFORE UPDATE ON v2_client_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_client_invoice_updated_at();

-- Update paid_amount and status on client invoice when payment is received
CREATE OR REPLACE FUNCTION update_client_invoice_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid DECIMAL(12,2);
  v_invoice_total DECIMAL(12,2);
  v_new_status TEXT;
BEGIN
  -- Calculate total payments for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM v2_client_payments
  WHERE client_invoice_id = COALESCE(NEW.client_invoice_id, OLD.client_invoice_id)
    AND deleted_at IS NULL;

  -- Get invoice total
  SELECT (amount + COALESCE(tax_amount, 0) - COALESCE(retainage_amount, 0)) INTO v_invoice_total
  FROM v2_client_invoices
  WHERE id = COALESCE(NEW.client_invoice_id, OLD.client_invoice_id);

  -- Determine new status
  IF v_total_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'sent';
  END IF;

  -- Update the invoice
  UPDATE v2_client_invoices
  SET
    paid_amount = v_total_paid,
    paid_at = CASE WHEN v_total_paid >= v_invoice_total THEN NOW() ELSE NULL END,
    status = CASE
      WHEN status IN ('draft', 'void') THEN status -- Don't change draft or void
      ELSE v_new_status
    END
  WHERE id = COALESCE(NEW.client_invoice_id, OLD.client_invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_on_payment_insert ON v2_client_payments;
CREATE TRIGGER trigger_update_invoice_on_payment_insert
  AFTER INSERT ON v2_client_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_invoice_payment();

DROP TRIGGER IF EXISTS trigger_update_invoice_on_payment_update ON v2_client_payments;
CREATE TRIGGER trigger_update_invoice_on_payment_update
  AFTER UPDATE ON v2_client_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_invoice_payment();

DROP TRIGGER IF EXISTS trigger_update_invoice_on_payment_delete ON v2_client_payments;
CREATE TRIGGER trigger_update_invoice_on_payment_delete
  AFTER DELETE ON v2_client_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_invoice_payment();

-- ============================================================
-- AR AGING VIEW
-- ============================================================
CREATE OR REPLACE VIEW v2_ar_aging AS
SELECT
  ci.builder_id,
  ci.id as invoice_id,
  ci.invoice_number,
  ci.job_id,
  j.name as job_name,
  ci.client_id,
  c.name as client_name,
  ci.invoice_date,
  ci.due_date,
  ci.total_amount,
  ci.paid_amount,
  ci.balance_due,
  ci.status,
  CURRENT_DATE - ci.due_date as days_past_due,
  CASE
    WHEN ci.due_date >= CURRENT_DATE THEN 'current'
    WHEN CURRENT_DATE - ci.due_date <= 30 THEN '1-30'
    WHEN CURRENT_DATE - ci.due_date <= 60 THEN '31-60'
    WHEN CURRENT_DATE - ci.due_date <= 90 THEN '61-90'
    ELSE '90+'
  END as aging_bucket
FROM v2_client_invoices ci
LEFT JOIN v2_jobs j ON ci.job_id = j.id
LEFT JOIN v2_clients c ON ci.client_id = c.id
WHERE ci.deleted_at IS NULL
  AND ci.status NOT IN ('draft', 'paid', 'void')
  AND ci.balance_due > 0;

-- ============================================================
-- AR AGING SUMMARY VIEW (Aggregated by bucket)
-- ============================================================
CREATE OR REPLACE VIEW v2_ar_aging_summary AS
SELECT
  builder_id,
  SUM(CASE WHEN aging_bucket = 'current' THEN balance_due ELSE 0 END) as current_amount,
  SUM(CASE WHEN aging_bucket = '1-30' THEN balance_due ELSE 0 END) as days_1_30,
  SUM(CASE WHEN aging_bucket = '31-60' THEN balance_due ELSE 0 END) as days_31_60,
  SUM(CASE WHEN aging_bucket = '61-90' THEN balance_due ELSE 0 END) as days_61_90,
  SUM(CASE WHEN aging_bucket = '90+' THEN balance_due ELSE 0 END) as days_90_plus,
  SUM(balance_due) as total_outstanding,
  COUNT(*) as invoice_count
FROM v2_ar_aging
GROUP BY builder_id;

-- ============================================================
-- AR SUMMARY VIEW (Overall AR stats)
-- ============================================================
CREATE OR REPLACE VIEW v2_ar_summary AS
SELECT
  ci.builder_id,
  COUNT(*) FILTER (WHERE ci.status = 'draft') as draft_count,
  SUM(ci.total_amount) FILTER (WHERE ci.status = 'draft') as draft_amount,
  COUNT(*) FILTER (WHERE ci.status = 'sent') as sent_count,
  SUM(ci.balance_due) FILTER (WHERE ci.status = 'sent') as sent_outstanding,
  COUNT(*) FILTER (WHERE ci.status = 'partial') as partial_count,
  SUM(ci.balance_due) FILTER (WHERE ci.status = 'partial') as partial_outstanding,
  COUNT(*) FILTER (WHERE ci.status = 'overdue' OR (ci.status IN ('sent', 'partial') AND ci.due_date < CURRENT_DATE)) as overdue_count,
  SUM(ci.balance_due) FILTER (WHERE ci.status = 'overdue' OR (ci.status IN ('sent', 'partial') AND ci.due_date < CURRENT_DATE)) as overdue_amount,
  COUNT(*) FILTER (WHERE ci.status = 'paid') as paid_count,
  SUM(ci.total_amount) FILTER (WHERE ci.status = 'paid') as paid_amount,
  SUM(ci.total_amount) as total_invoiced,
  SUM(ci.paid_amount) as total_collected,
  SUM(ci.balance_due) as total_outstanding
FROM v2_client_invoices ci
WHERE ci.deleted_at IS NULL
  AND ci.status != 'void'
GROUP BY ci.builder_id;

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE v2_client_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_client_invoice_activity ENABLE ROW LEVEL SECURITY;

-- Client invoices policies
CREATE POLICY "Builders manage their client invoices" ON v2_client_invoices
  FOR ALL USING (builder_id = get_current_builder_id());

-- Client payments policies
CREATE POLICY "Builders manage their client payments" ON v2_client_payments
  FOR ALL USING (builder_id = get_current_builder_id());

-- Client invoice activity policies
CREATE POLICY "Builders see their invoice activity" ON v2_client_invoice_activity
  FOR SELECT USING (
    client_invoice_id IN (SELECT id FROM v2_client_invoices WHERE builder_id = get_current_builder_id())
  );

-- ============================================================
-- HELPER FUNCTION: Generate next invoice number
-- ============================================================
CREATE OR REPLACE FUNCTION generate_client_invoice_number(p_builder_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
  v_number TEXT;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');

  -- Get next sequence number for this builder/year
  SELECT COALESCE(MAX(
    CASE
      WHEN invoice_number ~ ('^INV-' || v_year || '-\d+$')
      THEN CAST(SUBSTRING(invoice_number FROM '\d+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO v_seq
  FROM v2_client_invoices
  WHERE builder_id = p_builder_id
    AND invoice_number LIKE 'INV-' || v_year || '-%';

  v_number := 'INV-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;
