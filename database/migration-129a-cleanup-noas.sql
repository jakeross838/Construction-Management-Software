-- Migration 129a: Cleanup any partial NOA migration artifacts

-- Drop any existing triggers first
DROP TRIGGER IF EXISTS trg_noa_status ON v2_noas;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_noa_status();

-- Drop existing tables (if they exist) to start fresh
DROP TABLE IF EXISTS v2_noa_usages CASCADE;
DROP TABLE IF EXISTS v2_noas CASCADE;
