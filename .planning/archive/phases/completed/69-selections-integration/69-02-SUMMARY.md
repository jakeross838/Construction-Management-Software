---
phase: 69
plan: 02
subsystem: selections
tags:
  - selections
  - change-orders
  - variance
  - integration

dependency_graph:
  requires:
    - 69-01 (Variance Display & CO Prompt)
  provides:
    - CO badge visibility in selections list
    - Overage card state management
    - End-to-end workflow verification
  affects: []

tech_stack:
  added: []
  patterns:
    - CO badge visual indicator pattern
    - Conditional UI state based on data relationships

key_files:
  created: []
  modified:
    - public/js/selections.js
    - public/selections.html
    - server/routes/selections.js

decisions:
  - CO badge shows on selections with linked change orders
  - Overage card shows "Change Order Created" when CO exists
  - Create CO button hidden when CO already linked

metrics:
  duration: 8 minutes
  completed: 2026-01-20
---

# Phase 69 Plan 02: CO Visibility in Selections Page Summary

**One-liner:** CO badge on selections with linked change orders, overage card state management, schema fixes for CO creation

## What Was Built

### 1. CO Badge Display in Selections List
Added visual indicator for selections that have linked change orders:
- Orange "CO" badge with document icon appears in selection item footer
- Badge shows next to the status badge
- Badge has tooltip "Change Order Created"

### 2. Overage Card State Management
Updated the allowance detail modal's overage card:
- When variance > 0 (over budget), card shows
- If any selection has a change_order_id, shows "Change Order Created" with checkmark
- Shows count of selections linked to CO
- Hide "Create Change Order" button when CO exists

### 3. Bug Fixes (Auto-fixed during verification)
Fixed schema mismatch in CO creation endpoint:
- Changed `amount` to `amount_change` (correct column name)
- Added `change_order_number` (integer, required)
- Added `previous_total` and `new_total` calculations
- Added PO `change_order_total` update after CO creation

Fixed catalog API embed error:
- Added `!catalog_item_id` hint to disambiguate relationship
- Resolved PostgREST PGRST201 error for multiple FK relationships

## Key Code Changes

### public/js/selections.js
```javascript
// CO badge in renderSelectionsList()
const coBadge = s.change_order_id ? `
  <span class="badge badge-warning co-badge" title="Change Order Created">
    <svg>...</svg> CO
  </span>
` : '';

// Overage card state in renderAllowanceDetail()
const selectionsWithCO = currentSelections.filter(s => s.change_order_id);
if (selectionsWithCO.length > 0) {
  // Show "Change Order Created" info
  coButton.style.display = 'none';
  coExistsInfo.style.display = 'block';
}
```

### server/routes/selections.js
```javascript
// Fixed CO creation with correct schema
.insert({
  po_id: poId,
  change_order_number: nextCONumber,
  description: description,
  amount_change: coAmount,
  previous_total: previousTotal + existingCOTotal,
  new_total: newTotal,
  status: 'pending',
  created_by
})

// Fixed catalog images embed
images:v2_catalog_images!catalog_item_id(...)
```

## Verification Results

All integration requirements verified:

| Requirement | Status | Verification |
|-------------|--------|--------------|
| INT-01: Selections linked to jobs via allowances | Pass | Allowance shows job linkage, selections linked to allowance |
| INT-02: Budget tracking per category visible | Pass | Variance shows budget $1000, selected $1500, variance +$500 |
| INT-03: System generates CO when exceeding allowance | Pass | CO created with $575 (overage $500 + 15% markup) |

Test data created:
- Allowance: "Test Flooring Allowance" ($1000 budget)
- Selection: "Premium Hardwood" (qty 3 @ $500 = $1500)
- CO: $575 (overage with markup)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CO creation schema mismatch**
- **Found during:** Task 2 verification
- **Issue:** v2_change_orders uses `amount_change` not `amount`, requires `change_order_number` integer
- **Fix:** Updated insert statement with correct column names and added change_order_number calculation
- **Files modified:** server/routes/selections.js
- **Commit:** deaf67d

**2. [Rule 1 - Bug] Fixed catalog API embed error**
- **Found during:** Task 2 verification
- **Issue:** Multiple FK relationships between v2_selection_catalog and v2_catalog_images caused PostgREST error
- **Fix:** Added `!catalog_item_id` hint to disambiguate the relationship
- **Files modified:** server/routes/selections.js
- **Commit:** deaf67d

## Files Changed

| File | Changes |
|------|---------|
| public/js/selections.js | Added CO badge display, overage card state logic |
| public/selections.html | Added coExistsInfo div, createCOButton ID, CSS styles |
| server/routes/selections.js | Fixed CO creation schema, fixed catalog embed |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 2bde262 | feat | Add CO badge display in selections list |
| deaf67d | fix | Fix CO creation schema and catalog image embeds |

## Next Phase Readiness

Phase 69 (Selections Integration) is now complete:
- Plan 01: Variance display and CO prompt in catalog Add Selection flow
- Plan 02: CO visibility in selections page + integration verification

All three INT requirements are working end-to-end.
