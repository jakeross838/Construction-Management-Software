---
phase: 48-cost-code-linkage
plan: 01
subsystem: api
tags: [purchase-orders, validation, warnings, cost-codes]

# Dependency graph
requires:
  - phase: 47-invoice-variance
    provides: variance detection patterns
provides:
  - PO validation warning system for missing cost codes
  - getPOWarnings helper function
affects: [48-02, 48-03, 48-04, frontend-po-handling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - soft validation warnings pattern (non-blocking)
    - warning object structure with type, severity, count, items, message

key-files:
  created: []
  modified:
    - server/routes/purchase-orders.js

key-decisions:
  - "Warning returns max 5 item descriptions to avoid oversized responses"
  - "Warnings computed after PO/line items saved (not blocking creation)"
  - "Uses existing line_items from request body or fetches from existing PO"

patterns-established:
  - "Warning object structure: { type, severity, count, items, message }"

# Metrics
duration: 10min
completed: 2026-01-19
---

# Phase 48 Plan 01: PO Line Item Validation Warnings Summary

**Added getPOWarnings helper and integrated soft validation warnings into PO create/update routes**

## Performance

- **Duration:** 10 min
- **Started:** 2026-01-19T22:53:07Z
- **Completed:** 2026-01-19T23:03:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created `getPOWarnings()` helper function for checking line items without cost codes
- Integrated warnings into POST `/` (create PO) route
- Integrated warnings into PATCH `/:id` (update PO) route
- Warnings are non-blocking (soft validation) - PO operations still succeed
- Existing hard validation on send route preserved

## Task Commits

Each task was committed atomically:

1. **Task 1-2: getPOWarnings helper and route integration** - `3464014` (feat)

_Note: Both tasks combined as they form a single coherent feature in one file._

**Plan metadata:** (pending)

## Files Created/Modified

- `server/routes/purchase-orders.js` - Added getPOWarnings helper, modified POST and PATCH routes to include warnings in response

## Decisions Made

- Combined Tasks 1 and 2 into single commit since they modify the same file and form one feature
- Warning returns max 5 item descriptions to keep response size reasonable
- PATCH route uses provided line_items or falls back to existing.line_items from database
- No database queries needed for warning computation (uses request body data)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Edit tool file modification detection required using node.js script approach for string replacements

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Warning system ready for frontend integration
- Plan 48-02 (Enhanced AI Cost Code Suggestion) can proceed
- Plan 48-03 (Improved Line Item Matching) can proceed
- Plan 48-04 (G703 Validation Endpoint) depends on 48-01 through 48-03

---
*Phase: 48-cost-code-linkage*
*Completed: 2026-01-19*
