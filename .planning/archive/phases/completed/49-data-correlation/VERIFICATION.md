# Phase 49: Data Correlation - Verification Report

**Status:** `passed`
**Verified:** 2026-01-19
**Phase Goal:** Validate linkages and ensure data consistency across all entities

---

## Requirements Verification

### COR-01: Validate PO <-> Invoice <-> Draw linkage consistency

**Status:** PASSED

**Must-Haves Verified:**

| Must-Have | Evidence | Location |
|-----------|----------|----------|
| API returns linkage validation results for any job | `GET /api/jobs/:jobId/validate-linkages` endpoint exists | `server/routes/invoices.js:299-467` |
| Orphaned allocations detected and reported | Checks for ORPHANED_PO_ALLOCATION, ORPHANED_LINE_ITEM_ALLOCATION, ORPHANED_CO_ALLOCATION | `server/routes/invoices.js:369-409` |
| Broken PO/Draw links identified | DRAW_STATUS_MISMATCH detection for invoices in draws with wrong status | `server/routes/invoices.js:413-423` |
| Contains "validate-linkages" | Verified via grep | Line 299 |

**Implementation Details:**
- Endpoint collects all valid PO IDs, line item IDs, and CO IDs into Sets for O(1) lookup
- 6 validation checks implemented:
  1. ORPHANED_PO_ALLOCATION - allocation references deleted/missing PO
  2. ORPHANED_LINE_ITEM_ALLOCATION - allocation references deleted/missing line item
  3. ORPHANED_CO_ALLOCATION - allocation references deleted/missing CO
  4. DRAW_STATUS_MISMATCH - invoice in draw with wrong status
  5. ALLOCATION_SUM_EXCEEDS_INVOICE - allocations total more than invoice amount
  6. INVOICE_PO_NO_ALLOCATIONS - invoice has po_id but no allocations (warning)
- All errors/warnings include fix_hint field for actionable guidance
- Response format: `{ valid, errors, warnings, summary }`

---

### COR-02: Ensure CO/VPO totals reflected correctly in PO totals, budget committed amounts

**Status:** PASSED

**Must-Haves Verified:**

| Must-Have | Evidence | Location |
|-----------|----------|----------|
| CO/VPO totals validated against PO change_order_total | `GET /api/purchase-orders/:id/validate-totals` compares stored vs calculated CO totals | `server/routes/purchase-orders.js:1438-1621` |
| Budget committed_amount validated against actual COs | Checks budget line existence for CO cost codes | `server/routes/purchase-orders.js:1539-1594` |
| API returns validation results for PO/CO totals | Endpoint returns calculated vs stored comparison | `server/routes/purchase-orders.js:1602-1620` |
| Contains "validate-totals" | Verified via grep | Line 1438 |

**Additional Endpoints:**
- `GET /api/jobs/:id/validate-po-totals` - Batch validation for all POs in a job (`server/routes/jobs.js:204-370`)

**Error/Warning Types Implemented:**
- CO_TOTAL_MISMATCH - change_order_total doesn't match sum of approved COs
- PO_TOTAL_MISMATCH - total_amount doesn't match original + COs
- VPO_NOT_TRACKED - VPOs exist but not reflected in totals (warning)
- CO_NOT_IN_BUDGET - approved CO line items not reflected in budget committed_amount (warning)

**Response Structure:**
```javascript
{
  valid: boolean,
  po_id: string,
  po_number: string,
  calculated: { original_amount, co_total, vpo_total, expected_total, committed_to_budget },
  stored: { original_amount, change_order_total, total_amount },
  errors: [...],
  warnings: [...]
}
```

---

### COR-03: Integrate variance detection with price intelligence

**Status:** PASSED

**Must-Haves Verified:**

| Must-Have | Evidence | Location |
|-----------|----------|----------|
| Variance detector compares invoice prices to known best prices | `findBestPrice()` function looks up best known prices | `server/services/varianceDetector.js:275-410` |
| Price outliers flagged with percentage above best price | Calculates percentAbove and flags when >10% | `server/services/varianceDetector.js:786-810` |
| Price warnings include vendor price comparison | price_warnings array includes best_vendor, best_price, percent_above | `server/services/varianceDetector.js:792-806` |
| Contains "price_above_best" | Verified via grep | Lines 467, 793 |
| Contains "findBestPrice" | Function exported and used in detectVariances | Lines 275, 454, 776 |

**findBestPrice() Implementation:**
- Normalizes description text and extracts keywords
- Searches `v2_master_items` using keyword array overlap
- Scores matches using keyword overlap (60%) + text similarity (40%)
- Queries `v2_price_confidence` for vendors with confidence >= 0.6 (3/5 scale)
- Gets latest prices from `v2_price_history`
- Returns lowest price info with vendor, confidence, sample size

**Price Warning Structure:**
```javascript
{
  type: 'price_above_best',
  severity: 'high' | 'medium',  // >25% = high, >10% = medium
  line_description: string,
  invoice_price: number,
  best_price: number,
  best_vendor: string,
  best_vendor_id: string,
  percent_above: number,
  potential_savings: number,
  price_unit: string,
  confidence: number,
  sample_size: number,
  message: string
}
```

**detectVariances() Result Extensions:**
- `price_warnings: []` array added to result object (line 421)
- `potential_savings: 0` total added to result object (line 422)
- Price comparison runs for both PO-linked and non-PO invoices

---

### COR-04: Budget vs actual accuracy validation

**Status:** PASSED

**Must-Haves Verified:**

| Must-Have | Evidence | Location |
|-----------|----------|----------|
| Budget accuracy report shows variance by cost code | `GET /api/jobs/:id/budget-accuracy` returns by_cost_code array with variance fields | `server/routes/jobs.js:371-609` |
| What-if analysis shows impact of pending COs | pending_changes and what_if_approved sections in response | `server/routes/jobs.js:495-607` |
| Report identifies over-committed cost codes | OVER_COMMITTED error type, status field on each cost code | `server/routes/jobs.js:428-440` |
| Contains "budget-accuracy" | Verified via grep | Line 371 |

**Variance Calculations per Cost Code:**
- budgeted, committed, billed, paid amounts
- variance_committed: committed - budgeted
- variance_billed: billed - budgeted
- remaining_to_commit: budgeted - committed
- remaining_to_bill: committed - billed
- percent_committed: (committed / budgeted) * 100
- status: 'ok' | 'approaching' | 'over_committed' | 'over_billed'

**Error/Warning Types:**
- OVER_BILLED - billed > committed (error)
- OVER_COMMITTED - committed > budgeted (error)
- APPROACHING_LIMIT - committed > 90% of budgeted (warning)
- WOULD_EXCEED_BUDGET - what-if warning for pending COs

**What-If Analysis:**
- Fetches pending (non-approved) COs and VPOs
- Calculates projected impact by cost code from CO line items
- Returns `pending_changes` object with pending_co_count, pending_co_total, pending_vpo_count, pending_vpo_total, by_cost_code
- Returns `what_if_approved` object with projected totals and warnings for cost codes that would exceed budget

**Response Structure:**
```javascript
{
  job_id, job_name, valid,
  summary: { total_budgeted, total_committed, total_billed, total_paid, ... },
  by_cost_code: [{ cost_code_id, cost_code, budgeted, committed, billed, paid, variance_*, status }],
  errors: [...],
  warnings: [...],
  pending_changes: { pending_co_count, pending_co_total, pending_vpo_count, pending_vpo_total, by_cost_code },
  what_if_approved: { projected_total_committed, projected_total_variance, cost_codes_would_exceed, warnings }
}
```

---

## Summary

| Requirement | Status | Evidence Files |
|-------------|--------|----------------|
| COR-01: PO/Invoice/Draw linkage validation | PASSED | server/routes/invoices.js |
| COR-02: CO/VPO totals validation | PASSED | server/routes/purchase-orders.js, server/routes/jobs.js |
| COR-03: Price intelligence integration | PASSED | server/services/varianceDetector.js |
| COR-04: Budget accuracy validation | PASSED | server/routes/jobs.js |

**All 4 requirements verified in actual code.**

---

## Endpoints Created

| Endpoint | File | Lines | Purpose |
|----------|------|-------|---------|
| GET /api/jobs/:jobId/validate-linkages | server/routes/invoices.js | 299-467 | Detect orphaned allocations and broken links |
| GET /api/purchase-orders/:id/validate-totals | server/routes/purchase-orders.js | 1438-1621 | Validate PO totals against CO/VPO data |
| GET /api/jobs/:id/validate-po-totals | server/routes/jobs.js | 204-370 | Batch PO validation for entire job |
| GET /api/jobs/:id/budget-accuracy | server/routes/jobs.js | 371-609 | Budget variance analysis with what-if |

---

## Conclusion

Phase 49 (Data Correlation) has been **fully implemented**. All must-have requirements have been verified by examining the actual source code:

1. Linkage validation endpoint detects orphaned allocations and broken PO/Draw links with fix hints
2. PO total validation compares stored vs calculated CO/VPO totals with budget checks
3. Variance detector integrates price intelligence with findBestPrice() and price_warnings
4. Budget accuracy endpoint provides per-cost-code variance analysis with what-if projections

No gaps found. Phase verification status: **passed**
