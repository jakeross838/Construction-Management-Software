-- Migration 051: Clear Test Price Intelligence Data
-- Removes test/seed price data while keeping master items
-- Master items are kept as they define standardized material names

-- Clear test price history (entries with no source_id are test data)
DELETE FROM v2_price_history WHERE source_id IS NULL;

-- Clear confidence scores (will rebuild from real data)
DELETE FROM v2_price_confidence;

-- Clear vendor aliases (will rebuild as real invoices are processed)
DELETE FROM v2_vendor_item_aliases;

-- Clear savings log test data
DELETE FROM v2_savings_log;

-- Reset current prices view by refreshing (if it's a materialized view)
-- Note: v2_current_prices is a regular view, so it will auto-update

-- Log what was done
DO $$
BEGIN
  RAISE NOTICE 'Cleared test price intelligence data. Master items preserved.';
  RAISE NOTICE 'Price data will now be captured from real invoices.';
END $$;
