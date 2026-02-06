---
phase: 49-data-correlation
plan: 01
subsystem: api
tags: [validation, data-integrity, invoices, allocations, orphaned-data]

# Dependency graph
requires:
  - phase: 48-04
    provides: Validation endpoint pattern with errors/warnings/summary response format
provides:
  - GET /api/invoices/jobs/:jobId/validate-linkages endpoint
  - Orphaned allocation detection (PO, line item, CO)
  - Draw status mismatch detection
  - Allocation sum validation
affects: [draw-management, invoice-management, data-quality]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Linkage validation with fix_hint guidance for each error type
    - Parallel Set-based ID lookups for efficient orphan detection

key-files:
  created: []
  modified:
    - server/routes/invoices.js

key-decisions:
  - "Combined Task 1 and Task 2 since fix hints are integral to validation results"
  - "Used Set data structures for O(1) lookup of valid IDs"
  - "Included invoice_id, invoice_number, and amounts in all errors/warnings for easy identification"

patterns-established:
  - "Linkage validation pattern: collect valid IDs upfront, then iterate and check membership"

# Metrics
duration: 12min
completed: 2026-01-19
---

# Phase 49 Plan 01: Linkage Validation Endpoint Summary

**GET /api/invoices/jobs/:jobId/validate-linkages endpoint detecting orphaned allocations and broken PO/Draw links with actionable fix hints**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-19T15:00:00Z
- **Completed:** 2026-01-19T15:12:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created validation endpoint that checks all invoices and allocations for a given job
- Implemented 6 validation checks: 3 orphan types, draw status mismatch, allocation sum overflow, and PO with no allocations
- Included actionable fix_hint in every error and warning for user guidance
- Response format matches Phase 48 validation pattern (valid, errors, warnings, summary)

## Task Commits

Each task was committed atomically:

1. **Task 1 & 2: Linkage validation endpoint with fix hints** - `565904f` (feat)
   - Created GET /api/invoices/jobs/:jobId/validate-linkages endpoint
   - All fix hints included in initial implementation

**Plan metadata:** (will be included in docs commit)

## Files Created/Modified
- `server/routes/invoices.js` - Added linkage validation endpoint (lines 294-467)

## Decisions Made
- Combined Tasks 1 and 2 into a single commit since fix hints were integral to the validation result structure
- Used JavaScript Set for O(1) lookup performance when checking if referenced IDs exist
- Included full context (invoice_id, invoice_number, amounts) in each error/warning for easy troubleshooting

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation was straightforward following the Phase 48 validation pattern.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Validation endpoint ready for use
- Can be integrated with frontend data quality dashboard
- Ready for Plan 49-02: CO/VPO Total Validation

---
*Phase: 49-data-correlation*
*Completed: 2026-01-19*
