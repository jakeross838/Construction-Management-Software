---
phase: 49-data-correlation
plan: 02
subsystem: api
tags: [purchase-orders, validation, change-orders, vpo, budget, totals]

# Dependency graph
requires:
  - phase: 48-cost-code-linkage
    provides: validation warning patterns, getPOWarnings helper
provides:
  - PO total validation endpoint comparing stored vs calculated CO/VPO totals
  - Job-level batch PO validation with aggregated results
  - Error detection for CO_TOTAL_MISMATCH, PO_TOTAL_MISMATCH
  - Warning detection for VPO_NOT_TRACKED, CO_NOT_IN_BUDGET
affects: [49-03, 49-04, frontend-validation-display, 51-quick-fixes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - validation endpoint pattern with calculated vs stored comparison
    - batch validation with grouping and summary aggregation
    - error objects with fix_hint for actionable guidance

key-files:
  created: []
  modified:
    - server/routes/purchase-orders.js
    - server/routes/jobs.js

key-decisions:
  - "0.01 threshold for discrepancy detection (floating point tolerance)"
  - "VPOs tracked as warnings (not errors) since they may intentionally not be in totals"
  - "Budget line existence check for CO cost codes (can't verify exact committed amounts)"
  - "Batch validation fetches all data in parallel for efficiency"

patterns-established:
  - "Validation response: { valid, calculated, stored, errors, warnings }"
  - "Error object: { type, severity, details, fix_hint }"
  - "Batch validation: individual results + aggregated summary"

# Metrics
duration: 15min
completed: 2026-01-19
---

# Phase 49 Plan 02: CO/VPO Total Validation Summary

**Added PO total validation endpoints comparing stored totals against actual CO/VPO data with budget integration checks**

## Performance

- **Duration:** 15 min
- **Started:** 2026-01-19T23:50:00Z
- **Completed:** 2026-01-19T00:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `GET /api/purchase-orders/:id/validate-totals` endpoint for single PO validation
- Created `GET /api/jobs/:id/validate-po-totals` endpoint for batch job-level validation
- Validates change_order_total matches sum of approved CO amount_changes
- Validates total_amount equals original_amount + change_order_total
- Reports VPOs not tracked in totals as warnings
- Checks budget lines exist for CO line item cost codes
- Returns calculated vs stored comparison with fix hints

## Task Commits

Each task was committed atomically:

1. **Task 1: PO total validation endpoint** - `c7f1c48` (feat)
2. **Task 2: Batch job validation endpoint** - `9391084` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `server/routes/purchase-orders.js` - Added GET /:id/validate-totals endpoint with CO/VPO/budget validation
- `server/routes/jobs.js` - Added GET /:id/validate-po-totals for batch job-level validation

## Decisions Made

- Used 0.01 threshold for discrepancy detection to handle floating point precision
- VPOs reported as warnings since they may intentionally be separate from PO totals
- Budget line existence check only (exact committed amount verification requires all-PO context)
- Batch endpoint fetches all COs and VPOs in parallel queries for efficiency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Single PO validation ready for use in PO modal or approval flow
- Job-level validation ready for pre-draw checks
- Ready for Plan 49-03 (Price Intelligence Integration)
- Error types (CO_TOTAL_MISMATCH, PO_TOTAL_MISMATCH) ready for Phase 51 quick fixes

---
*Phase: 49-data-correlation*
*Completed: 2026-01-19*
