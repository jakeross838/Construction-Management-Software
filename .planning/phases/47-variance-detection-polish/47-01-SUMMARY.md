---
phase: 47-variance-detection-polish
plan: 01
subsystem: ui
tags: [variance, vpo, change-order, invoice-modal, javascript]

# Dependency graph
requires:
  - phase: 46-ai-accuracy
    provides: Variance detector service and VPO backend implementation
provides:
  - Action buttons on variance warning banner for unmatched line items
  - createVPOFromVariance handler with pre-filled form
  - createCOFromVariance handler with pre-filled form
  - CSS styling for variance action buttons
affects: [invoice-modal, variance-detection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Variance action button pattern for inline resolution
    - Modal overlay pattern for VPO creation from variance context
    - Re-use of existing showCreateCOModal pattern adapted for variance

key-files:
  created: []
  modified:
    - public/js/modals.js
    - public/css/styles.css

key-decisions:
  - "Show only Create CO button if description suggests change order (contains 'change order', 'CO #')"
  - "Show both Quick VPO and Create CO buttons for regular unmatched items"
  - "Auto-approve COs created from variance since they're resolving known variance"
  - "Refresh invoice after VPO/CO creation to update variance banner state"

patterns-established:
  - "Variance resolution pattern: inline action buttons -> modal form -> API call -> refresh"

# Metrics
duration: 8min
completed: 2026-01-19
---

# Phase 47 Plan 01: Variance Action Buttons Summary

**Action buttons on variance warning banner enable quick VPO and CO creation from unmatched invoice line items**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-19T00:00:00Z
- **Completed:** 2026-01-19T00:08:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Variance warning banner now shows "Quick VPO" and "Create CO" buttons for unmatched line items
- VPO creation form opens pre-filled with line item description and amount
- CO creation form opens pre-filled with line item data and auto-approves
- Variance banner refreshes after VPO/CO creation to reflect resolved status

## Task Commits

Each task was committed atomically:

1. **Task 1: Add action buttons to variance warnings** - `195021c` (feat)
2. **Task 2: Implement createVPOFromVariance handler** - `5034c5d` (feat)
3. **Task 3: Implement createCOFromVariance handler** - `57fbd5b` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `public/js/modals.js` - Added action buttons to buildVarianceWarningsBanner, createVPOFromVariance, createCOFromVariance handlers
- `public/css/styles.css` - Added .variance-actions button styles

## Decisions Made

- **Conditional button display:** Show only "Create CO" if description suggests it's already a change order (contains 'change order', 'CO #', etc.), otherwise show both "Quick VPO" and "Create CO"
- **Auto-approve COs:** COs created from variance are auto-approved with status='approved' since they're resolving a known variance
- **Refresh pattern:** After VPO/CO creation, call openInvoice() to refresh the invoice and update the variance banner

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Variance action buttons complete, users can now resolve unmatched line items directly from invoice modal
- Ready for Phase 47 Plan 02 (variance detection service polish) if desired
- VPO/CO creation flows integrate with existing PO and job change order systems

---
*Phase: 47-variance-detection-polish*
*Completed: 2026-01-19*
