-- Migration 172: Contract Pricing Engine
-- Add fields to support different contract pricing models

-- Add pricing type and related fields to contracts
ALTER TABLE v2_contracts
ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'fixed_price'
  CHECK (pricing_type IN ('fixed_price', 'cost_plus', 'gmp', 'time_materials', 'unit_price')),
ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES v2_estimates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS base_cost DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS builder_fee_percent DECIMAL(5,2) DEFAULT 15.00,
ADD COLUMN IF NOT EXISTS builder_fee_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS overhead_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS overhead_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS profit_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS contingency_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS contingency_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS gmp_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS allowances_total DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS savings_split_owner_percent DECIMAL(5,2) DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS unit_prices JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES v2_leads(id) ON DELETE SET NULL;

-- Create contract pricing breakdown table for detailed line items
CREATE TABLE IF NOT EXISTS v2_contract_pricing_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES v2_contracts(id) ON DELETE CASCADE,

  -- Line item details
  description TEXT NOT NULL,
  category TEXT,  -- labor, material, subcontract, equipment, overhead, fee, allowance
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  -- Amounts
  quantity DECIMAL(12,4) DEFAULT 1,
  unit TEXT DEFAULT 'ls',
  unit_cost DECIMAL(12,2),
  amount DECIMAL(12,2) NOT NULL,

  -- Markup
  markup_percent DECIMAL(5,2) DEFAULT 0,
  markup_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2),

  -- Flags
  is_allowance BOOLEAN DEFAULT false,
  is_owner_direct BOOLEAN DEFAULT false,  -- For owner-direct items in cost plus

  -- Source reference
  estimate_line_id UUID,  -- Link back to estimate line if imported

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_pricing_lines_contract
  ON v2_contract_pricing_lines(contract_id);
CREATE INDEX IF NOT EXISTS idx_contracts_estimate
  ON v2_contracts(estimate_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_lead
  ON v2_contracts(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_pricing_type
  ON v2_contracts(pricing_type) WHERE deleted_at IS NULL;

-- Function to calculate contract amounts from pricing lines
CREATE OR REPLACE FUNCTION calculate_contract_pricing()
RETURNS TRIGGER AS $$
DECLARE
  contract_record RECORD;
  total_base DECIMAL(12,2);
  total_allowances DECIMAL(12,2);
BEGIN
  -- Get the contract
  SELECT * INTO contract_record FROM v2_contracts WHERE id = COALESCE(NEW.contract_id, OLD.contract_id);

  -- Sum pricing lines
  SELECT
    COALESCE(SUM(CASE WHEN NOT is_allowance THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_allowance THEN amount ELSE 0 END), 0)
  INTO total_base, total_allowances
  FROM v2_contract_pricing_lines
  WHERE contract_id = contract_record.id;

  -- Update contract based on pricing type
  IF contract_record.pricing_type = 'cost_plus' THEN
    -- Cost Plus: base cost + fee
    UPDATE v2_contracts SET
      base_cost = total_base,
      allowances_total = total_allowances,
      builder_fee_amount = total_base * (COALESCE(builder_fee_percent, 15) / 100),
      contract_amount = total_base + (total_base * (COALESCE(builder_fee_percent, 15) / 100)) + total_allowances,
      updated_at = NOW()
    WHERE id = contract_record.id;

  ELSIF contract_record.pricing_type = 'gmp' THEN
    -- GMP: capped at gmp_amount, includes fee
    UPDATE v2_contracts SET
      base_cost = total_base,
      allowances_total = total_allowances,
      builder_fee_amount = total_base * (COALESCE(builder_fee_percent, 15) / 100),
      contract_amount = LEAST(
        COALESCE(gmp_amount, 999999999),
        total_base + (total_base * (COALESCE(builder_fee_percent, 15) / 100)) + total_allowances
      ),
      updated_at = NOW()
    WHERE id = contract_record.id;

  ELSE
    -- Fixed Price: use the totals directly with markup
    UPDATE v2_contracts SET
      base_cost = total_base,
      allowances_total = total_allowances,
      overhead_amount = total_base * (COALESCE(overhead_percent, 0) / 100),
      profit_amount = (total_base + (total_base * COALESCE(overhead_percent, 0) / 100)) * (COALESCE(profit_percent, 0) / 100),
      contingency_amount = total_base * (COALESCE(contingency_percent, 0) / 100),
      contract_amount = total_base
        + (total_base * COALESCE(overhead_percent, 0) / 100)
        + ((total_base + (total_base * COALESCE(overhead_percent, 0) / 100)) * COALESCE(profit_percent, 0) / 100)
        + (total_base * COALESCE(contingency_percent, 0) / 100)
        + total_allowances,
      updated_at = NOW()
    WHERE id = contract_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate on pricing line changes
DROP TRIGGER IF EXISTS recalc_contract_pricing ON v2_contract_pricing_lines;
CREATE TRIGGER recalc_contract_pricing
  AFTER INSERT OR UPDATE OR DELETE ON v2_contract_pricing_lines
  FOR EACH ROW
  EXECUTE FUNCTION calculate_contract_pricing();

-- Function to import estimate into contract
CREATE OR REPLACE FUNCTION import_estimate_to_contract(
  p_contract_id UUID,
  p_estimate_id UUID
)
RETURNS void AS $$
DECLARE
  est_line RECORD;
BEGIN
  -- Clear existing pricing lines
  DELETE FROM v2_contract_pricing_lines WHERE contract_id = p_contract_id;

  -- Import from estimate lines
  FOR est_line IN
    SELECT * FROM v2_estimate_lines WHERE estimate_id = p_estimate_id
  LOOP
    INSERT INTO v2_contract_pricing_lines (
      contract_id,
      description,
      category,
      cost_code_id,
      quantity,
      unit,
      unit_cost,
      amount,
      markup_percent,
      markup_amount,
      total_amount,
      is_allowance,
      estimate_line_id,
      sort_order
    ) VALUES (
      p_contract_id,
      est_line.description,
      est_line.cost_type,
      est_line.cost_code_id,
      est_line.quantity,
      est_line.unit,
      est_line.unit_cost,
      est_line.amount,
      COALESCE(est_line.markup_percent, 0),
      COALESCE(est_line.markup_amount, 0),
      COALESCE(est_line.total_with_markup, est_line.amount),
      COALESCE(est_line.is_allowance, false),
      est_line.id,
      est_line.sort_order
    );
  END LOOP;

  -- Update contract with estimate reference
  UPDATE v2_contracts
  SET estimate_id = p_estimate_id,
      updated_at = NOW()
  WHERE id = p_contract_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger for pricing lines updated_at
CREATE OR REPLACE FUNCTION update_pricing_lines_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_pricing_lines_timestamp ON v2_contract_pricing_lines;
CREATE TRIGGER set_pricing_lines_timestamp
  BEFORE UPDATE ON v2_contract_pricing_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_lines_timestamp();
