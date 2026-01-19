---
phase: 44-invoice-pipeline
plan: 01
subsystem: api
tags: [supabase, invoice, allocation, cleanup, po, change-order]

# Dependency graph
requires:
  - phase: 43-budget-integrity
    provides: increment/decrement RPC functions for budget tracking
provides:
  - cleanupInvoiceAllocations helper function that reverses PO/CO amounts and removes allocations
  - Automatic allocation cleanup on invoice denial
  - Automatic allocation cleanup on invoice deletion
affects: [45-draw-po-linking, 46-ai-accuracy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allocation cleanup pattern: fetch allocations, decrement linked amounts, delete allocations"

key-files:
  created: []
  modified:
    - server/services/invoiceHelpers.js
    - server/routes/invoices.js

key-decisions:
  - "Cleanup happens before soft-delete to ensure data integrity"
  - "Cleanup is safe to call with no allocations (no-op)"
  - "PO line item decrement uses existing updatePOLineItemsForAllocations function"
  - "CO decrement queries current amount and subtracts (Math.max(0, ...) prevents negative)"

patterns-established:
  - "Allocation cleanup pattern: reusable function for reversing invoice allocations"

# Metrics
duration: 8min
completed: 2026-01-19
---

# Phase 44 Plan 01: Invoice Allocation Cleanup Summary

**cleanupInvoiceAllocations helper function that removes allocations and reverses PO/CO amounts on invoice denial or deletion**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-19T17:20:00Z
- **Completed:** 2026-01-19T17:28:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Created cleanupInvoiceAllocations helper function in invoiceHelpers.js
- Function decrements PO line item invoiced_amount for all PO-linked allocations
- Function decrements CO invoiced_amount for all CO-linked allocations
- Function deletes all allocations from v2_invoice_allocations
- Integrated cleanup into invoice denial transition (POST /:id/transition)
- Integrated cleanup into invoice delete endpoint (DELETE /:id)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cleanupInvoiceAllocations helper function** - `4c2ee9f` (feat)
2. **Task 2: Call cleanup on denied transition** - `2585a5b` (feat)
3. **Task 3: Call cleanup on delete operation** - `633eb41` (feat)

## Files Created/Modified

- `server/services/invoiceHelpers.js` - Added cleanupInvoiceAllocations function (69 lines) and exported it
- `server/routes/invoices.js` - Added import and calls to cleanupInvoiceAllocations in denied transition and delete endpoint

## Decisions Made

- **Cleanup before soft-delete**: The cleanup happens after the undo snapshot is created but before the soft-delete, ensuring allocations are properly reversed
- **Reuse existing functions**: Used updatePOLineItemsForAllocations(poId, allocations, false) to decrement PO amounts rather than duplicating logic
- **Safe no-op**: Function returns { success: true, allocations_removed: 0 } if no allocations exist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Allocation cleanup is now automatic on invoice denial/deletion
- PO line item invoiced_amount correctly decrements
- CO invoiced_amount correctly decrements
- Ready for phase 45 (draw-po-linking) which may build on this foundation

---
*Phase: 44-invoice-pipeline*
*Completed: 2026-01-19*
