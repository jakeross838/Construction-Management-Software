---
phase: 48-cost-code-linkage
plan: 04
subsystem: api
tags: [draws, validation, g703, cost-codes, budget]

# Dependency graph
requires:
  - phase: 48-01
    provides: PO validation warnings infrastructure
provides:
  - GET /api/draws/:id/validate endpoint
  - Submit flow validation for missing budget lines
  - Validation error/warning response format
affects: [draw-management, g703-export, budget-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Validation endpoint returns errors (blocking) and warnings (informational)
    - Submit flow integrates validation as gatekeeper

key-files:
  created: []
  modified:
    - server/routes/draws.js

key-decisions:
  - "Validation returns errors (block submission) and warnings (informational only)"
  - "Submit flow fails with 400 if any allocation lacks budget line"
  - "Removed deleted_at filter from queries (v2_draws table has no such column)"

patterns-established:
  - "Draw validation pattern: GET /:id/validate for pre-submit checks"
  - "Validation response structure: {valid, errors, warnings, summary}"

# Metrics
duration: 35min
completed: 2026-01-19
---

# Phase 48 Plan 04: G703 Validation Endpoint Summary

**GET /api/draws/:id/validate endpoint and submit flow validation for cost code budget line checks**

## Performance

- **Duration:** 35 min
- **Started:** 2026-01-19T23:15:00Z
- **Completed:** 2026-01-19T23:50:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created validation endpoint returning errors and warnings for draw data quality
- Integrated validation into submit flow as mandatory gatekeeper
- Fixed bug with deleted_at filter on v2_draws table (column doesn't exist)

## Task Commits

Each task was committed atomically:

1. **Task 1 & 2: Validation endpoint and submit integration** - `51e9d92` (feat)
   - Created GET /:id/validate endpoint
   - Added validation check to submit flow

**Note:** Tasks 1 and 2 were committed together since Task 2 modifies the same code block as Task 1 and depends on it.

## Files Created/Modified
- `server/routes/draws.js` - Added validation endpoint (lines 727-831), modified submit endpoint (lines 833-905)

## Decisions Made
- Validation returns `errors` (blocking - prevent submission) and `warnings` (informational only)
- Missing budget line for any allocation cost code is a blocking error
- Empty draw is a warning, not an error (user may be preparing the draw)
- Total mismatch between stored and calculated is a warning (might be CO billings)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid deleted_at filter**
- **Found during:** Task 1 (Validation endpoint testing)
- **Issue:** v2_draws table has no deleted_at column, query was returning no results
- **Fix:** Removed `.is('deleted_at', null)` filter from validation and submit queries
- **Files modified:** server/routes/draws.js
- **Verification:** Endpoint returns valid response for existing draws
- **Committed in:** 51e9d92 (part of task commit)

---

**Total deviations:** 1 auto-fixed (bug fix)
**Impact on plan:** Bug fix was essential for functionality. No scope creep.

## Issues Encountered
- File modification detection was overly sensitive, required using patch script and sed to apply changes
- Resolved by creating Node.js patch script to apply transformations

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Validation endpoint ready for frontend integration
- Submit flow now validates cost code coverage
- Future: Could add more validation rules (over-budget warnings, etc.)

---
*Phase: 48-cost-code-linkage*
*Completed: 2026-01-19*
