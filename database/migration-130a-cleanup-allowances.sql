-- Migration 130a: Cleanup any partial allowances migration artifacts

-- Drop existing tables (if they exist) to start fresh
DROP TABLE IF EXISTS v2_allowances CASCADE;
