---
phase: 43-budget-integrity
plan: 02
subsystem: api
tags: [express, supabase, rpc, budget, purchase-orders, change-orders]

# Dependency graph
requires:
  - phase: 43-01
    provides: RPC functions (increment_committed_amount, decrement_committed_amount)
provides:
  - PO void route calls decrement_committed_amount for each line item
  - CO approval route calls increment_committed_amount for each CO line item
  - Error handling around all budget RPC calls
affects: [43-03, budget-tracking, draws]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "try/catch around RPC calls for graceful degradation"
    - "Conditional budget updates based on approval_status"

key-files:
  created: []
  modified:
    - server/routes/purchase-orders.js

key-decisions:
  - "RPC failures logged but don't fail PO operations (graceful degradation)"
  - "Only decrement committed if PO was previously approved"
  - "CO approval updates budget for each line item with cost_code_id"

patterns-established:
  - "Budget RPC call pattern: try { await supabase.rpc(...) } catch { console.error(...) }"

# Metrics
duration: 2min
completed: 2026-01-19
---

# Phase 43 Plan 02: PO Budget Sync Summary

**Wired PO void and CO approval routes to update budget committed_amount via RPC, completing the PO lifecycle budget tracking**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-19T17:07:01Z
- **Completed:** 2026-01-19T17:09:21Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Added decrement_committed_amount call to PO void route (only for approved POs)
- Added increment_committed_amount call to CO approval route for each CO line item
- Added try/catch error handling around all budget RPC calls for graceful degradation
- PO operations now complete even if budget updates fail

## Task Commits

Each task was committed atomically:

1. **Task 1: Add decrement_committed_amount to PO void route** - `dece4a1` (feat)
2. **Task 2: Add committed_amount update to CO approval** - `af76d2d` (feat)
3. **Task 3: Add error handling for RPC failures** - `ad46e13` (fix)

## Files Created/Modified
- `server/routes/purchase-orders.js` - Added budget sync to void route, CO approve route, and error handling to approve route

## Decisions Made
- **RPC failures are logged but don't fail operations**: PO approve/void/CO operations complete even if budget line is missing. This prevents budget tracking issues from blocking core workflow.
- **Only decrement if previously approved**: The void route checks `po.approval_status === 'approved'` before decrementing, ensuring we don't try to reverse commits that never happened.
- **CO approval increments for each line item**: Each CO line item with a cost_code_id and amount gets its own increment call.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Budget sync is now complete for all PO lifecycle events (approve, void, CO approve)
- Ready for 43-03-PLAN.md to fix draws.js zero-budget line creation
- All RPC calls from Plan 01 are now properly wired and have error handling

---
*Phase: 43-budget-integrity*
*Completed: 2026-01-19*
