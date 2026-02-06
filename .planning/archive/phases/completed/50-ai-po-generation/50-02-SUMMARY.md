# Plan 50-02: Database-Driven Cost Code Assignment - Summary

**Status:** COMPLETE
**Completed:** 2026-01-19

## Objective

Replace hardcoded keyword mapping in `suggestCostCodes()` with database-driven approach using v2_cost_codes table and AI learning patterns.

## Changes Made

### Database Migration (migration-066-cost-code-keywords.sql)

1. **Added columns to v2_cost_codes:**
   - `keywords TEXT[]` - Array of keywords for pattern matching
   - `trade_types TEXT[]` - Array of vendor trade types for defaults

2. **Populated keywords for common cost codes:**
   - Cabinets (21101): cabinet, cabinets, cabinetry, vanity, millwork, pantry, laundry
   - Countertops (21103): countertop, granite, quartz, marble, stone
   - Appliances (22101): appliance, refrigerator, range, dishwasher, microwave, oven
   - Flooring (23101-23102): floor, flooring, carpet, hardwood, lvp, vinyl
   - Tile (24101-24102): tile, ceramic, porcelain, backsplash
   - Plumbing (12101-12102): plumbing, faucet, toilet, sink, shower
   - Electrical (13101-13102): electrical, wiring, panel, lighting, fixture
   - HVAC (14101): hvac, ac, air conditioning, duct
   - Drywall (19101): drywall, sheetrock
   - Painting (27101): paint, painting
   - And more...

3. **Created v2_cost_code_mappings table:**
   - `description_pattern` - Normalized pattern (first 50 chars, lowercase)
   - `cost_code_id` - Reference to cost code
   - `vendor_trade` - Trade context for specific mappings
   - `confidence` - Score (0.80 default, increases with usage)
   - `usage_count` - Tracks confirmation count

4. **Created RPC function:**
   - `increment_cost_code_mapping_usage()` - Boosts confidence with usage

### Server Changes (server/ai-po-processor.js)

1. **Refactored suggestCostCodes():**
   - Queries v2_cost_codes with keywords and trade_types columns
   - Queries v2_cost_code_mappings for learned patterns
   - Priority order: learned_pattern > keyword > trade_default
   - Returns confidence score and match reason per line item

2. **Added learnCostCodeMapping() function:**
   - Saves user corrections to v2_cost_code_mappings
   - Increments usage count for existing mappings
   - Boosts confidence based on confirmation count

### API Endpoints (server/routes/purchase-orders.js)

1. **POST /api/purchase-orders/learn-cost-code**
   - Saves cost code mapping from user correction
   - Body: `{ description, cost_code_id, vendor_trade? }`

2. **GET /api/purchase-orders/cost-code-mappings**
   - Lists learned mappings for debugging/admin
   - Query params: `vendor_trade`, `limit`

## Verification Checklist

- [x] Cost codes have keywords column populated
- [x] v2_cost_code_mappings table created
- [x] suggestCostCodes() queries database instead of hardcoded map
- [x] Each line item includes cost_code_confidence field
- [x] Learning function saves user corrections
- [x] API endpoints exposed for learning

## Commits

1. `feat(50-02): add cost code keywords table` - Migration 066
2. `refactor(50-02): database-driven suggestCostCodes()` - Core logic refactor
3. `feat(50-02): add API endpoints for cost code learning` - REST API

## Notes

- Learned patterns take priority over static keywords for adaptive improvement
- Confidence increases by 0.01 per usage up to 0.99 max
- Trade type context allows different mappings for same description across vendors
- Original hardcoded map converted to database keywords for maintainability
