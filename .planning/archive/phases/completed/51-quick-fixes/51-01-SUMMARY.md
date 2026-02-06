# Summary: Fix Endpoints with Auto-Correction

**Plan:** 51-01
**Status:** Complete
**Date:** 2026-01-19

## What Was Built

Three fix endpoints that allow users to automatically correct validation errors identified by Phase 49 validation endpoints:

### 1. Fix Orphaned Allocation Endpoint
- **Path:** `POST /api/invoices/:id/fix-allocation`
- **File:** `server/routes/invoices.js`
- **Actions:**
  - `remove` - Deletes orphaned allocations that reference deleted POs/COs
  - `reassign` - Reassigns allocation to a valid PO, line item, or CO
- **Returns:** Remaining allocation count after fix

### 2. Fix PO Totals Endpoint
- **Path:** `POST /api/purchase-orders/:id/fix-totals`
- **File:** `server/routes/purchase-orders.js`
- **Actions:**
  - `co_total` - Recalculates change_order_total from approved COs
  - `po_total` - Recalculates total_amount as original + CO total
- **Returns:** Validation status after fix with old/new values

### 3. Batch Fix Validation Errors Endpoint
- **Path:** `POST /api/jobs/:id/fix-validation-errors`
- **File:** `server/routes/jobs.js`
- **Supported Fixes:**
  - `ORPHANED_PO_ALLOCATION` + `remove` - Removes all orphaned allocations
  - `PO_TOTAL_MISMATCH` + `recalculate` - Recalculates all PO totals
- **Returns:** Count of fixed/failed items with details

## Key Design Decisions

1. **Activity Logging:** All fix actions are logged for audit trail using existing activity logging patterns
2. **Re-validation:** PO fix endpoint returns validation status after fix to confirm success
3. **Error Handling:** Batch operations continue on individual failures, reporting both fixed and failed counts
4. **Idempotent:** Running fix multiple times is safe - only actual discrepancies are corrected

## Commits

1. `feat(51-01): add fix orphaned allocation endpoint`
2. `feat(51-01): add fix PO totals endpoint`
3. `feat(51-01): add batch fix validation errors endpoint`

## Verification Checklist

- [x] POST /api/invoices/:id/fix-allocation removes orphaned allocations
- [x] POST /api/invoices/:id/fix-allocation reassigns allocations to new PO
- [x] POST /api/purchase-orders/:id/fix-totals recalculates CO and PO totals
- [x] POST /api/jobs/:id/fix-validation-errors handles batch fixes
- [x] All endpoints log activity for audit trail
- [x] Error handling returns meaningful messages

## Files Modified

| File | Changes |
|------|---------|
| `server/routes/invoices.js` | +92 lines - fix-allocation endpoint |
| `server/routes/purchase-orders.js` | +102 lines - fix-totals endpoint |
| `server/routes/jobs.js` | +150 lines - fix-validation-errors endpoint |

## Integration Notes

These endpoints are designed to work with the validation endpoints from Phase 49:
- `GET /api/invoices/jobs/:jobId/validate-linkages` - Identifies orphaned allocations
- `GET /api/purchase-orders/:id/validate-totals` - Identifies PO total mismatches
- `GET /api/jobs/:id/validate-po-totals` - Batch validation for all job POs

Users can now:
1. Run validation to identify errors
2. Call fix endpoints to automatically correct them
3. Re-run validation to confirm fixes worked
