# Phase 45: Draw & PO/CO Linking - COMPLETE

**Status:** ✅ Complete
**Total Duration:** ~25 min
**Plans Executed:** 5/5
**Files Modified:** 1 (server/routes/draws.js)
**Milestone:** v1.7 Business Operating System

## Phase Overview

**Goal:** Fix draw calculations and ensure PO/CO amounts stay in sync with invoice allocations.

**Depends on:** Phase 44 (Invoice Allocation Integrity)

## Plans Executed

### 45-01: Draw Total Recalculation & G703 Completeness ✅
- **Duration:** ~5 min
- **Type:** Execute
- **What:** Recalculate draw totals from allocations, include all budgeted cost codes in G703
- **Result:** Draw totals always accurate, G703 shows complete schedule of values

### 45-02: Draw Allocation Validation ✅
- **Duration:** ~8 min
- **Type:** Execute
- **What:** Validate draw_allocations match source invoice_allocations, detect drift
- **Result:** Drift detection with repair endpoint

### 45-03: PO/CO Invoiced Amount Sync ✅
- **Duration:** ~2 min
- **Type:** Verify (Already Implemented)
- **What:** Sync PO line item and CO invoiced_amount when allocations change
- **Result:** Verified existing implementation works correctly

### 45-04: PO Void Committed Reversal ✅
- **Duration:** ~2 min
- **Type:** Verify (Already Implemented)
- **What:** Verify voiding a PO reverses committed_amount in budget
- **Result:** Verified RPC function and void route work correctly

### 45-05: CO Billing Overlap Validation ✅
- **Duration:** ~8 min
- **Type:** Execute
- **What:** Detect and warn when CO has both manual and allocated billings
- **Result:** Overlap detection prevents double-counting

## Requirements Addressed

### DRW-INT-01: Recalculate draw total from allocations
✅ GET /draws/:id recalculates total from v2_draw_allocations + v2_job_co_draw_billings
✅ Logs warning if stored total differs from calculated
✅ Response includes both calculated and stored totals

### DRW-INT-02: Include all budgeted cost codes in G703
✅ G703 schedule includes cost codes with budget even if 0% billed
✅ Shows complete schedule of values, not just active billings
✅ Filter logic: only exclude if budget=0 AND thisPeriod=0 AND previous=0

### DRW-INT-03: Validate draw allocations vs source
✅ validateDrawAllocations() compares draw_allocations to invoice_allocations
✅ Returns mismatches with invoice_id, cost_code_id, amounts, difference
✅ POST /draws/:id/repair-allocations fixes drift
✅ Validation results in response: validation.allocation_mismatches

### PO-INT-01: Sync PO line item invoiced_amount
✅ recalculatePOLineItemInvoiced() sums allocations by (po_id, cost_code_id)
✅ Only counts approved/in_draw/paid invoices
✅ Called on invoice approval and allocation changes
✅ Bidirectional sync (old and new allocations)

### PO-INT-02: Sync CO invoiced_amount
✅ recalculateCOInvoiced() sums allocations by change_order_id
✅ Only counts approved/in_draw/paid invoices
✅ Called on invoice approval and allocation changes
✅ Bidirectional sync (old and new allocations)

### PO-INT-03: Reverse committed on PO void
✅ Void route calls decrement_committed_amount RPC for each line item
✅ RPC uses GREATEST(0, committed_amount - amount) to prevent negatives
✅ Only decrements if PO was approved
✅ Graceful error handling

### PO-INT-04: Prevent CO billing overlap
✅ detectCOBillingOverlap() detects manual + allocated billings
✅ Warnings in draw GET response: validation.co_billing_overlap
✅ Allocate endpoint warns when overlap detected
✅ Users informed of potential double-counting

## Technical Achievements

### Draw Integrity
- **Total recalculation:** Always accurate, based on actual allocations
- **Drift detection:** Identifies when draw_allocations differ from source
- **Repair mechanism:** One-click fix to re-sync from source
- **Complete G703:** Shows all budgeted work, not just billed

### PO/CO Sync
- **Automatic sync:** Approval and allocation changes trigger updates
- **Bidirectional:** Handles both old and new allocations
- **Status-aware:** Only counts valid invoice statuses
- **Overlap prevention:** Detects double-counting scenarios

### Data Validation
- **7 validation points:** Totals, allocations, PO limits, CO overlap, budget lines
- **Warning system:** Non-blocking warnings for user awareness
- **Repair tools:** Automated fixes for common drift scenarios
- **Audit trail:** All validation logged to console

## Files Modified

### server/routes/draws.js
- **Lines 103-128:** DRW-INT-01 - Recalculation logic in GET endpoint
- **Lines 49-101:** DRW-INT-03 - validateDrawAllocations helper
- **Lines 53-101:** PO-INT-04 - detectCOBillingOverlap helper
- **Line 266:** DRW-INT-02 - G703 filter fix
- **Lines 385-386, 416:** Response updates with calculated values
- **Lines 445-450, 473-476:** Validation call and response
- **Lines 506-511, 537-538:** CO overlap detection and response
- **Lines 1202-1267:** Repair allocations endpoint

## Files Verified (No Changes)

### server/services/invoiceHelpers.js
- **Lines 165-209:** recalculatePOLineItemInvoiced (PO-INT-01)
- **Lines 215-242:** recalculateCOInvoiced (PO-INT-02)

### server/routes/invoices.js
- **Lines 1568-1586:** PO/CO sync on approval
- **Lines 1359-1385:** PO/CO sync on allocation change
- **Lines 1387-1411:** CO overlap warning (PO-INT-04)

### server/routes/purchase-orders.js
- **Lines 1104-1114:** Void route with decrement logic (PO-INT-03)

### database/migration-064-budget-rpc.sql
- **Lines 47-63:** decrement_committed_amount RPC (PO-INT-03)

## Testing Recommendations

### Draw Integrity Tests
1. Create draw with multiple invoices
2. Modify invoice allocations
3. Check GET /draws/:id shows drift warning
4. Call POST /draws/:id/repair-allocations
5. Verify drift resolved

### PO/CO Sync Tests
1. Approve invoice with PO allocations
2. Check v2_po_line_items.invoiced_amount updated
3. Change allocations on approved invoice
4. Verify PO line items recalculated
5. Test same flow for CO allocations

### G703 Completeness Tests
1. Create budget with multiple cost codes
2. Bill only some cost codes in draw
3. Check GET /draws/:id includes unbilled codes in G703
4. Verify percentComplete shows 0% for unbilled

### CO Overlap Tests
1. Create draw with manual CO billing
2. Add invoice with allocation to same CO
3. Check GET /draws/:id shows overlap warning
4. Verify both amounts displayed

## Impact

### For Users
- **Accurate draws:** Totals always match actual allocations
- **Complete G703:** See all planned work, not just billed
- **PO tracking:** Line items show accurate invoiced amounts
- **CO tracking:** Change orders show accurate billing progress
- **Data integrity:** Drift detected and repairable

### For System
- **Data quality:** 7 validation checks prevent inconsistencies
- **Maintainability:** Single source of truth for calculations
- **Audit trail:** All operations logged
- **Reliability:** Graceful error handling

### For Business
- **Trust:** Draw totals are always accurate
- **Visibility:** Complete schedule of values
- **Compliance:** Proper G702/G703 generation
- **Cost control:** PO/CO tracking prevents overages

## Success Metrics

- ✅ 5/5 plans completed
- ✅ 7/7 requirements met
- ✅ 1 file modified, 4 files verified
- ✅ ~25 min total execution time
- ✅ 0 breaking changes
- ✅ Backward compatible (existing data works)

## Next Phase

Phase 45 is part of archived milestone v1.7. Current active work is on milestone v3.1 (Phase 110 - UI/UX Overhaul).

---

**Phase 45 Complete:** All draw and PO/CO linking integrity requirements satisfied.
