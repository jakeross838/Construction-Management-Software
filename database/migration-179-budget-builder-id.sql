-- Migration 179: Add builder_id to v2_budgets for multi-tenancy
-- The budget route needs builder_id for proper tenant isolation

ALTER TABLE v2_budgets ADD COLUMN IF NOT EXISTS builder_id UUID;

-- Create index for tenant queries
CREATE INDEX IF NOT EXISTS idx_v2_budgets_builder_id ON v2_budgets(builder_id);

-- Also add to v2_budget_lines if needed for direct queries
ALTER TABLE v2_budget_lines ADD COLUMN IF NOT EXISTS builder_id UUID;
CREATE INDEX IF NOT EXISTS idx_v2_budget_lines_builder_id ON v2_budget_lines(builder_id);
