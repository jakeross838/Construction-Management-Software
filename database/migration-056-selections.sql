-- Migration 056: Selections/Allowances System
-- Creates tables for allowance tracking, selection catalog, and client selections

-- ============================================================
-- SELECTION CATEGORIES (reference table for dropdown)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_selection_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default selection categories
INSERT INTO v2_selection_categories (name, description, display_order) VALUES
  ('Flooring', 'Hardwood, tile, carpet, LVP', 1),
  ('Cabinets', 'Kitchen and bathroom cabinets', 2),
  ('Countertops', 'Kitchen and bath countertops', 3),
  ('Appliances', 'Kitchen appliances package', 4),
  ('Plumbing Fixtures', 'Faucets, sinks, toilets, tubs', 5),
  ('Lighting', 'Light fixtures and ceiling fans', 6),
  ('Hardware', 'Door handles, cabinet pulls', 7),
  ('Paint Colors', 'Interior and exterior paint', 8),
  ('Tile', 'Backsplash, shower tile, accent tile', 9),
  ('Doors', 'Interior and exterior doors', 10),
  ('Windows', 'Window styles and upgrades', 11),
  ('Landscaping', 'Outdoor plants and hardscaping', 12),
  ('Other', 'Miscellaneous selections', 99)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ALLOWANCES (budget per job per category)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES v2_selection_categories(id),

  -- Budget
  name TEXT NOT NULL,
  description TEXT,
  budgeted_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  allowance_type TEXT DEFAULT 'material_only', -- material_only, installed

  -- Deadline
  deadline DATE,
  deadline_notes TEXT,

  -- Status tracking
  status TEXT DEFAULT 'pending', -- pending, in_progress, complete

  -- Calculated (updated by triggers/API)
  selected_amount DECIMAL(12,2) DEFAULT 0,
  variance DECIMAL(12,2) DEFAULT 0, -- selected - budgeted (positive = over)

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(job_id, category_id, name)
);

-- ============================================================
-- SELECTION CATALOG (master list of available options)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_selection_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES v2_selection_categories(id),
  vendor_id UUID REFERENCES v2_vendors(id),

  -- Item info
  name TEXT NOT NULL,
  description TEXT,
  model_number TEXT,
  sku TEXT,

  -- Pricing
  unit_price DECIMAL(12,2),
  unit TEXT DEFAULT 'each', -- each, sqft, lnft, etc.

  -- Media
  image_url TEXT,
  spec_sheet_url TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SELECTIONS (client choices)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allowance_id UUID NOT NULL REFERENCES v2_allowances(id) ON DELETE CASCADE,
  catalog_item_id UUID REFERENCES v2_selection_catalog(id),

  -- Selection details (can override catalog or be custom)
  name TEXT NOT NULL,
  description TEXT,
  model_number TEXT,
  vendor_name TEXT,

  -- Pricing
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT DEFAULT 'each',
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,

  -- Markup for overages
  markup_percent DECIMAL(5,2) DEFAULT 0,
  markup_amount DECIMAL(12,2) DEFAULT 0,
  final_price DECIMAL(12,2) NOT NULL,

  -- Status workflow
  status TEXT DEFAULT 'pending', -- pending, selected, approved, ordered, installed

  -- Approval
  selected_at TIMESTAMPTZ,
  selected_by TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  ordered_at TIMESTAMPTZ,
  installed_at TIMESTAMPTZ,

  -- Change order link (when overage generates CO)
  change_order_id UUID REFERENCES v2_change_orders(id),

  -- Media
  image_url TEXT,

  -- Notes
  client_notes TEXT,
  internal_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- SELECTION STATUS HISTORY (for audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_selection_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES v2_selections(id) ON DELETE CASCADE,

  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  notes TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_allowances_job_id ON v2_allowances(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_allowances_category_id ON v2_allowances(category_id);
CREATE INDEX IF NOT EXISTS idx_v2_allowances_status ON v2_allowances(status);
CREATE INDEX IF NOT EXISTS idx_v2_allowances_deadline ON v2_allowances(deadline);
CREATE INDEX IF NOT EXISTS idx_v2_allowances_deleted_at ON v2_allowances(deleted_at);

CREATE INDEX IF NOT EXISTS idx_v2_selection_catalog_category_id ON v2_selection_catalog(category_id);
CREATE INDEX IF NOT EXISTS idx_v2_selection_catalog_vendor_id ON v2_selection_catalog(vendor_id);

CREATE INDEX IF NOT EXISTS idx_v2_selections_allowance_id ON v2_selections(allowance_id);
CREATE INDEX IF NOT EXISTS idx_v2_selections_status ON v2_selections(status);
CREATE INDEX IF NOT EXISTS idx_v2_selections_deleted_at ON v2_selections(deleted_at);

CREATE INDEX IF NOT EXISTS idx_v2_selection_status_history_selection_id ON v2_selection_status_history(selection_id);

-- ============================================================
-- TRIGGERS FOR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_allowance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_allowance_updated_at ON v2_allowances;
CREATE TRIGGER trigger_allowance_updated_at
  BEFORE UPDATE ON v2_allowances
  FOR EACH ROW
  EXECUTE FUNCTION update_allowance_updated_at();

CREATE OR REPLACE FUNCTION update_selection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_selection_updated_at ON v2_selections;
CREATE TRIGGER trigger_selection_updated_at
  BEFORE UPDATE ON v2_selections
  FOR EACH ROW
  EXECUTE FUNCTION update_selection_updated_at();

CREATE OR REPLACE FUNCTION update_selection_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_selection_catalog_updated_at ON v2_selection_catalog;
CREATE TRIGGER trigger_selection_catalog_updated_at
  BEFORE UPDATE ON v2_selection_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_selection_catalog_updated_at();

-- ============================================================
-- TRIGGER TO UPDATE ALLOWANCE TOTALS
-- ============================================================
CREATE OR REPLACE FUNCTION update_allowance_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_allowance_id UUID;
  v_selected_total DECIMAL(12,2);
  v_budgeted DECIMAL(12,2);
BEGIN
  -- Determine which allowance to update
  IF TG_OP = 'DELETE' THEN
    v_allowance_id := OLD.allowance_id;
  ELSE
    v_allowance_id := NEW.allowance_id;
  END IF;

  -- Calculate new totals
  SELECT COALESCE(SUM(final_price), 0)
  INTO v_selected_total
  FROM v2_selections
  WHERE allowance_id = v_allowance_id
    AND deleted_at IS NULL;

  -- Get budget
  SELECT budgeted_amount INTO v_budgeted
  FROM v2_allowances
  WHERE id = v_allowance_id;

  -- Update allowance
  UPDATE v2_allowances
  SET
    selected_amount = v_selected_total,
    variance = v_selected_total - COALESCE(v_budgeted, 0),
    status = CASE
      WHEN v_selected_total = 0 THEN 'pending'
      WHEN EXISTS (
        SELECT 1 FROM v2_selections
        WHERE allowance_id = v_allowance_id
          AND deleted_at IS NULL
          AND status IN ('pending', 'selected')
      ) THEN 'in_progress'
      ELSE 'complete'
    END
  WHERE id = v_allowance_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_allowance_totals ON v2_selections;
CREATE TRIGGER trigger_update_allowance_totals
  AFTER INSERT OR UPDATE OR DELETE ON v2_selections
  FOR EACH ROW
  EXECUTE FUNCTION update_allowance_totals();
