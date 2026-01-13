-- Migration 014: Move Development and Permitting Services to General Conditions
-- This is in-house permitting agent time (overhead), not permit fees

UPDATE v2_cost_codes SET category = 'General Conditions' WHERE code LIKE '01105%'; -- Development and Permitting Services
