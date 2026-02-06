---
phase: 49-data-correlation
plan: 04
subsystem: api
tags: [budget, variance, what-if, cost-codes, validation]

# Dependency graph
requires:
  - phase: 49-01
    provides: Linkage validation endpoint patterns
  - phase: 49-02
    provides: CO/VPO total validation patterns
provides:
  - GET /api/jobs/:id/budget-accuracy endpoint
  - Budget variance analysis by cost code
  - What-if projections for pending COs/VPOs
affects: [budget-management, cost-tracking, change-orders]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - What-if analysis pattern for pending changes
    - Budget accuracy validation with error/warning categorization

key-files:
  created: []
  modified:
    - server/routes/jobs.js

key-decisions:
  - "Over-committed and over-billed are errors (blocking), approaching 90% is warning"
  - "0.01 threshold for floating point comparison in budget checks"
  - "VPOs tracked separately since they don't have cost code line items"

patterns-established:
  - "Budget accuracy endpoint pattern: current state + what-if projections"
  - "Pending CO impact calculation via CO line items"

# Metrics
duration: 12min
completed: 2026-01-19
---

# Phase 49 Plan 04: Budget Accuracy Report Summary

**GET /api/jobs/:id/budget-accuracy endpoint with variance analysis and what-if projections for pending COs/VPOs**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-19T19:00:00Z
- **Completed:** 2026-01-19T19:12:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created comprehensive budget accuracy endpoint with per-cost-code variance analysis
- Added what-if analysis showing projected impact of approving pending COs
- Implemented status flags (ok, approaching, over_committed, over_billed)
- Integrated pending VPO tracking for full change order visibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create budget accuracy endpoint** - `94825c8` (feat)
2. **Task 2: Add what-if analysis for pending COs** - `15d1b6e` (feat)

## Files Created/Modified
- `server/routes/jobs.js` - Added budget-accuracy endpoint with variance and what-if analysis

## Decisions Made
- Over-committed and over-billed cost codes are flagged as errors (blocking)
- Cost codes at 90%+ committed are flagged as warnings (approaching limit)
- 0.01 threshold used for floating point comparisons (consistent with 49-02)
- VPOs tracked at job level only since they don't have cost code line items
- CO impact calculated from change_order_line_items for cost code granularity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Budget accuracy endpoint ready for frontend integration
- Provides foundation for budget health dashboard
- What-if analysis enables proactive budget management

---
*Phase: 49-data-correlation*
*Completed: 2026-01-19*
