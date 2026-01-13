-- Migration 013: Move Copies to General Conditions
-- Copies is admin overhead, belongs in General Conditions

UPDATE v2_cost_codes SET category = 'General Conditions' WHERE code LIKE '03108%'; -- Copies
