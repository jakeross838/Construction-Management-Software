---
phase: 44-invoice-pipeline
plan: 04
subsystem: invoices
tags: [budget, billed_amount, draw_allocations, recalculation]

# Dependency graph
requires:
  - phase: 44-01
    provides: cleanupInvoiceAllocations helper for allocation management
provides:
  - recalculateBilledAmounts helper for budget line recalculation
  - In-draw allocation change triggers budget recalculation
  - Invoice billed_amount sync when allocations change in draw
affects: [draws, budget-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Draw allocation sync pattern for in-draw invoices
    - Budget line recalculation from draw_allocations

key-files:
  created: []
  modified:
    - server/services/invoiceHelpers.js
    - server/routes/invoices.js

key-decisions:
  - "Recalculation queries v2_draw_allocations to get actual billed amounts"
  - "Invoice billed_amount updated only when invoice is in a draw"
  - "Affected cost codes collected from both old and new allocations"

patterns-established:
  - "Budget recalculation from draw allocations for accuracy"

# Metrics
duration: 3 min
completed: 2026-01-19
---

# Phase 44 Plan 04: Billed Amount Recalculation Summary

**Automatic billed_amount recalculation for budget lines when in-draw invoice allocations change**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-19T17:25:40Z
- **Completed:** 2026-01-19T17:29:10Z
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments

- Created `recalculateBilledAmounts` helper to recalculate budget line billed_amount from draw allocations
- Added detection of in-draw invoices during allocation changes
- Automatic budget line recalculation when allocations change for in-draw invoices
- Invoice billed_amount sync to match new allocation totals
- Draw allocations sync to match invoice allocations when changed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create recalculateBilledAmounts helper** - `55f8edc` (feat)
2. **Task 2: Trigger recalculation when allocations change for in-draw invoice** - `a24602c` (feat)
3. **Task 3: Update invoice billed_amount on allocation change** - `c6cfe7d` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `server/services/invoiceHelpers.js` - Added recalculateBilledAmounts helper function
- `server/routes/invoices.js` - Updated allocate endpoint with in-draw detection and recalculation

## Decisions Made

- **Query draw_allocations for accurate totals**: Rather than tracking incremental changes, recalculation queries actual draw_allocations to ensure accuracy
- **Collect affected cost codes from old and new**: Both old allocations (before change) and new allocations are checked to ensure all affected budget lines are updated
- **Sync draw_allocations on change**: When allocations change for an in-draw invoice, draw_allocations are deleted and re-inserted to match

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Budget billed_amount now accurately reflects draw allocations even when invoices change after being added to draw
- Ready for 44-05 (if exists) or phase transition
- All invoice integrity fixes from audit (items 3-4) now addressed

---
*Phase: 44-invoice-pipeline*
*Completed: 2026-01-19*
