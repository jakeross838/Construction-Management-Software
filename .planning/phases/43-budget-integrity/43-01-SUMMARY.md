---
phase: 43-budget-integrity
plan: 01
subsystem: database
tags: [postgresql, rpc, supabase, atomic-updates, budget]

# Dependency graph
requires:
  - phase: None (first plan in v1.7)
    provides: Fresh start for v1.7 milestone
provides:
  - increment_committed_amount RPC function for PO approval
  - decrement_committed_amount RPC function for PO void
  - Atomic budget updates without race conditions
affects: [43-02 (PO void workflow), budget-tracking, purchase-orders]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER RPC functions for Supabase client calls"
    - "Atomic UPDATE with RETURNING for budget modifications"
    - "GREATEST(0, value) pattern to prevent negative amounts"

key-files:
  created:
    - database/migration-064-budget-rpc.sql
  modified: []

key-decisions:
  - "increment raises exception if budget line missing (require budget setup before PO approval)"
  - "decrement is no-op for missing budget lines (void should not fail)"
  - "Function format: LANGUAGE/SECURITY DEFINER/SET after body for Supabase API compatibility"

patterns-established:
  - "RPC function format: RETURNS TYPE AS $$ ... END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public"

# Metrics
duration: 5min
completed: 2026-01-19
---

# Phase 43 Plan 01: Budget RPC Functions Summary

**PostgreSQL RPC functions for atomic committed_amount updates on v2_budget_lines, enabling PO approval/void workflow to modify budget without race conditions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-19T16:59:11Z
- **Completed:** 2026-01-19T17:04:15Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created `increment_committed_amount` RPC for PO approval workflow
- Created `decrement_committed_amount` RPC for PO void workflow
- Applied migration-064 to production database
- Both functions use atomic UPDATE operations with proper error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create budget RPC migration file** - `f87c427` (feat)
   - Task 2 (run migration) included in same commit as it only applied the file

**Note:** Tasks 1 and 2 share a commit because Task 2 was applying the migration created in Task 1.

## Files Created/Modified
- `database/migration-064-budget-rpc.sql` - Two RPC functions for atomic budget committed_amount updates

## Decisions Made
- **increment raises exception if budget line missing**: Prevents committing to non-existent budget lines; requires budget setup before PO approval
- **decrement is no-op for missing budget lines**: Voiding a PO should succeed even if budget line was deleted; prevents negative amounts with GREATEST(0, ...)
- **Function format adjustment**: Changed from LANGUAGE before AS $$ to LANGUAGE after body (Supabase API statement parser compatibility)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed function format for Supabase API compatibility**
- **Found during:** Task 2 (run migration)
- **Issue:** Original format with LANGUAGE/SECURITY DEFINER/SET before AS $$ caused Supabase API statement parser to fail
- **Fix:** Moved all options after the function body: `END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;`
- **Files modified:** database/migration-064-budget-rpc.sql
- **Verification:** Migration ran successfully after format change
- **Committed in:** f87c427 (amended to include fix)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Format fix was necessary for migration to apply. No scope creep.

## Issues Encountered
- Migration initially failed with "unterminated dollar-quoted string" error
- Root cause: Supabase Management API statement splitter doesn't handle the pre-body format correctly
- Resolution: Reformatted to match working migrations in codebase (LANGUAGE after function body)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RPC functions are now available in database
- Plan 43-02 can proceed to wire decrement_committed_amount into PO void route
- Purchase order approval already calls increment_committed_amount (will now work)

---
*Phase: 43-budget-integrity*
*Completed: 2026-01-19*
