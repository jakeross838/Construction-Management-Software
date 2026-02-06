---
phase: 108-selections-allowances
plan: 01
subsystem: database
tags: [postgresql, selections, allowances, estimates, migration]

# Dependency graph
requires:
  - phase: 106
    provides: v2_estimate_lines table with is_allowance flag
  - phase: 056
    provides: v2_allowances, v2_selections, v2_selection_categories tables
provides:
  - estimate_line_id column on v2_allowances for traceability
  - client approval fields on v2_selections for approval workflow
  - convert_estimate_allowances() function for estimate-to-allowance conversion
  - get_allowance_variance_summary() function for variance reporting
affects: [108-02, 108-03, selections, proposals]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent conversion function with duplicate detection"
    - "Category matching with fuzzy fallback to 'Other'"

key-files:
  created:
    - database/migration-119-selections-estimate-bridge.sql
  modified: []

key-decisions:
  - "ON DELETE SET NULL for estimate_line_id - keeps allowance if estimate line deleted"
  - "Client approval as separate fields from admin approval for clear audit trail"
  - "Idempotent conversion function prevents duplicate allowances on re-run"

patterns-established:
  - "Estimate-to-job entity conversion via database function"
  - "Category matching with cost code name fuzzy matching + fallback"

# Metrics
duration: 5min
completed: 2026-01-22
---

# Phase 108 Plan 01: Estimate-to-Selections Bridge Summary

**Database schema extensions bridging estimate allowance lines to the existing selections system with client approval tracking fields**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-22T16:45:00Z
- **Completed:** 2026-01-22T16:50:00Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Added `estimate_line_id` column to `v2_allowances` to track which estimate line created each allowance
- Added 5 client approval columns to `v2_selections` for tracking client approval with audit trail
- Created `convert_estimate_allowances()` function that converts estimate allowance lines to job allowances when estimate is approved
- Created `get_allowance_variance_summary()` helper function for aggregate variance reporting
- Documented 6 test scenarios for the conversion function

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration file** - `491d3e5` (feat)
2. **Task 2: Run migration** - N/A (migration applied, no code change)
3. **Task 3: Document test scenarios** - N/A (included in Task 1 commit)

## Files Created/Modified

- `database/migration-119-selections-estimate-bridge.sql` - Schema extensions and functions for estimate-to-selections bridge

## Decisions Made

1. **ON DELETE SET NULL for estimate_line_id** - If the original estimate line is deleted, the allowance remains but loses its reference. This preserves allowances that were already created.
2. **Separate client approval fields** - Added `client_approved_at`, `client_approved_by`, `client_approval_ip`, `client_approval_method`, `client_approval_notes` as separate fields from the existing admin approval fields for clear separation of concerns.
3. **Idempotent conversion function** - Function checks if allowances were already created from this estimate before creating new ones, preventing duplicates on re-run.
4. **Category matching strategy** - Uses fuzzy matching on cost code name with fallback to "Other" category if no match found.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial migration run failed with Supabase API error (rate limiting/auth issue)
- Retry succeeded - migration applied successfully on second attempt

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema extensions in place for estimate-to-allowance workflow
- Ready for 108-02: API routes for client approval and allowance conversion
- Ready for 108-03: Client-facing selection view with approval UI

---
*Phase: 108-selections-allowances*
*Completed: 2026-01-22*
