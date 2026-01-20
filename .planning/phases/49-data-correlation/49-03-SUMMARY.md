---
phase: 49-data-correlation
plan: 03
subsystem: api
tags: [variance-detection, price-intelligence, supabase]

# Dependency graph
requires:
  - phase: 47
    provides: Variance detector service with line item matching
  - phase: price-intelligence
    provides: v2_master_items, v2_price_confidence, v2_price_history tables
provides:
  - Price comparison warnings in variance detection
  - Best price lookup helper function
  - Potential savings calculation per invoice
affects: [invoice-modal, variance-ui, cost-analysis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Keyword overlap matching for master item lookup"
    - "Confidence-based price filtering (>= 3 out of 5)"
    - "10%/25% thresholds for price warnings"

key-files:
  created: []
  modified:
    - server/services/varianceDetector.js

key-decisions:
  - "10% threshold for flagging prices above best known price"
  - "25% threshold for high severity price warnings"
  - "Run price comparison for both PO-linked and non-PO invoices"
  - "Minimum confidence score of 0.6 (3/5) for price data inclusion"
  - "$10 minimum line item amount for price comparison"

patterns-established:
  - "Price warnings as separate array from PO variance warnings"
  - "Potential savings aggregated at invoice level"

# Metrics
duration: 12min
completed: 2026-01-19
---

# Phase 49 Plan 03: Price Intelligence Integration Summary

**Integrated price comparison into variance detection to flag invoice line items priced above known best prices with potential savings calculations**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-19T18:00:00Z
- **Completed:** 2026-01-19T18:12:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `findBestPrice()` helper function to look up best known prices from price intelligence data
- Integrated price comparison into `detectVariances()` with warning generation
- Extended result object with `price_warnings` array and `potential_savings` total
- Price comparison works for both PO-linked and non-PO invoices
- Documented thresholds in file header

## Task Commits

Each task was committed atomically:

1. **Task 1: Add price lookup helper function** - `893a90b` (feat)
2. **Task 2: Integrate price comparison into detectVariances** - `b6638c8` (feat)

## Files Created/Modified

- `server/services/varianceDetector.js` - Added findBestPrice() function and price comparison logic in detectVariances()

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 10% threshold for price warnings | Avoids noise from minor price variations while catching significant overpayments |
| 25% threshold for high severity | Distinguishes critical pricing issues needing immediate attention |
| Confidence >= 3 (0.6) filter | Ensures price comparisons use reliable historical data |
| $10 minimum line item | Avoids overhead of price lookup for trivial amounts |
| Run for non-PO invoices too | Price intelligence value exists independent of PO matching |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

### findBestPrice() Function

```javascript
async function findBestPrice(supabaseClient, description, vendorId, costCodeId)
```

Lookup flow:
1. Extract keywords from description using `normalizeText()`
2. Search `v2_master_items` using keyword array overlap
3. Score matches using keyword overlap (60%) + text similarity (40%)
4. Query `v2_price_confidence` for vendors with confidence >= 0.6
5. Get latest prices from `v2_price_history`
6. Return lowest price info with vendor, confidence, sample size

### Price Warning Object Structure

```javascript
{
  type: 'price_above_best',
  severity: 'high' | 'medium',  // >25% = high, >10% = medium
  line_description: string,
  invoice_price: number,
  best_price: number,
  best_vendor: string,
  best_vendor_id: string,
  percent_above: number,
  potential_savings: number,
  price_unit: string,
  confidence: number,  // 1-5 scale
  sample_size: number,
  message: string
}
```

### detectVariances() Result Extension

```javascript
{
  hasVariances: boolean,
  warnings: [...],           // Existing PO variance warnings
  price_warnings: [...],     // NEW: Price comparison warnings
  potential_savings: number, // NEW: Total potential savings
  details: {...}
}
```

## Verification

- [x] findBestPrice() returns price data for items with price history
- [x] findBestPrice() returns null for items without price data
- [x] detectVariances() includes price_warnings in response
- [x] Warnings show percentage above best price and potential savings
- [x] Existing variance tests still pass (35/35)
- [x] Server starts without errors

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 49 Plan 03 complete. Ready for Plan 04 (Budget Accuracy Report).

---
*Phase: 49-data-correlation*
*Completed: 2026-01-19*
