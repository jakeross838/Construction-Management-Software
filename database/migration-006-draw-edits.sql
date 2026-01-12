-- Migration 006: Draw Editing Enhancements
-- Adds columns for draw header editing and G702 amount overrides

-- Add notes field for draw
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add G702 override columns (when user wants to manually adjust calculated values)
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS g702_original_contract_override DECIMAL(12,2);
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS g702_change_orders_override DECIMAL(12,2);

-- Add updated_at timestamp for tracking edits
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
