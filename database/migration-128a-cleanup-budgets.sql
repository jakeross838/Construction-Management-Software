-- Migration 128.5: Cleanup any partial budget migration artifacts
-- This drops any triggers/functions that might have been partially created

-- Drop any existing triggers first
DROP TRIGGER IF EXISTS trg_update_budget_totals ON v2_budget_lines;
DROP TRIGGER IF EXISTS trg_budget_number ON v2_budgets;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_budget_totals();
DROP FUNCTION IF EXISTS generate_budget_number();

-- Drop existing tables (if they exist) to start fresh
DROP TABLE IF EXISTS v2_budget_lines CASCADE;
DROP TABLE IF EXISTS v2_budgets CASCADE;
