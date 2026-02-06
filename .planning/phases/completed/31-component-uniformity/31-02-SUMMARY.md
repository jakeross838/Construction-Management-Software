# Phase 31-02: PO and Search Status Class Normalization

## Summary
Extended status class normalization to Purchase Order and Global Search modules, ensuring consistent hyphen-based CSS class names across all status badges.

## Changes Made

### Task 1: po-app.js
**File:** `public/js/po-app.js`
- Added `normalizeStatusClass` helper at top of file with window.normalizeStatusClass fallback
- Updated `renderPORow()` status badge: `status-${normalizeStatusClass(statusClass)}`
- Updated `renderPOCard()` status badge: `status-${normalizeStatusClass(statusClass)}`

### Task 2: po-modals.js
**File:** `public/js/po-modals.js`
- Added `normalizeStatusClass` helper at top of file with window.normalizeStatusClass fallback
- Updated PO modal header status badge in `renderPOModal()`
- Updated invoice status in `renderSummaryPanel()`: `status-${normalizeStatusClass(inv.status)}`
- Updated change order status in `renderChangeOrderItem()`: `status-${normalizeStatusClass(statusClass)}`
- Updated punch list status in `renderPunchListCompact()`: `${normalizeStatusClass(statusClass)}`

### Task 3: global-search.js
**File:** `public/js/global-search.js`
- Added `normalizeStatusClass` helper inside IIFE with window.normalizeStatusClass fallback
- Updated search result status in `performSearch()`: `status-${normalizeStatusClass(r.status)}`

## Technical Details

The `normalizeStatusClass` function:
```javascript
const normalizeStatusClass = window.normalizeStatusClass || function(status) {
  if (!status) return '';
  return status.toString().toLowerCase().replace(/_/g, '-');
};
```

This converts status values like `needs_approval` to `needs-approval` for CSS class compatibility.

## Commits
1. `2f3ece3` - Add normalizeStatusClass to po-app.js for consistent status badges
2. `6e24598` - Add normalizeStatusClass to po-modals.js for consistent status badges
3. `b675bd1` - Add normalizeStatusClass to global-search.js for consistent status badges

## Verification
- [x] po-app.js has normalizeStatusClass and uses it
- [x] po-modals.js has normalizeStatusClass and uses it
- [x] global-search.js has normalizeStatusClass and uses it
- [x] All files compile without errors (JavaScript syntax valid)

## Related
- Phase 31-01: Initial status class normalization in app.js and modals.js
- UI-STANDARDS.md: Documents the hyphen-based status class convention
