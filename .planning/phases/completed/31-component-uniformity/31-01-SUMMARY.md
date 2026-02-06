---
phase: 31-component-uniformity
plan: 01
status: completed
completed_at: 2026-01-18
commits:
  - 5533bfb: "Add normalizeStatusClass helper for CSS class name normalization"
  - 5139779: "Add hyphen-based CSS status classes for backward compatibility"
  - ede9862: "Update modals.js to use normalized status class names"
---

# Summary: Status Class Naming Normalization

## Objective
Fixed status class naming inconsistency by converting underscore-based status values (e.g., `needs_approval`) to hyphen-based CSS class names (e.g., `needs-approval`), following standard CSS naming conventions.

## Changes Made

### Task 1: Add normalizeStatusClass Helper (app.js)
**File:** `public/js/app.js`

Added a global helper function near the top of the file:
```javascript
function normalizeStatusClass(status) {
  if (!status) return '';
  return status.toString().toLowerCase().replace(/_/g, '-');
}
window.normalizeStatusClass = normalizeStatusClass;
```

Updated invoice card rendering to use the helper:
- Line 631: Invoice card class (`status-${normalizeStatusClass(inv.status)}`)
- Line 646: Status pill class (`status-${normalizeStatusClass(inv.status)}`)
- Line 849: Invoice modal status pill

### Task 2: Add Hyphen-based CSS Classes (styles.css)
**File:** `public/css/styles.css`

Added hyphen versions alongside underscore versions using comma-separated selectors for backward compatibility:

| Selector Type | Classes Updated |
|--------------|-----------------|
| `.invoice-card.status-*` | needs_review, ready_for_approval, needs_approval, in_draw |
| `.status-badge.status-*` | needs_approval, in_draw |
| Generic `.status-*` | needs_approval, in_draw, partially_funded |
| `#poModal .status-pill.status-*` | needs_approval, in_draw |
| `.po-invoices-card .invoice-status.status-*` | in_draw, needs_approval |
| `.inv-status.status-*` | in_draw, needs_approval |
| `.search-result-status.status-*` | needs_approval |

### Task 3: Update modals.js Status Class Usage
**File:** `public/js/modals.js`

Added normalizeStatusClass reference with fallback:
```javascript
const normalizeStatusClass = window.normalizeStatusClass || function(status) {
  if (!status) return '';
  return status.toString().toLowerCase().replace(/_/g, '-');
};
```

Updated status badge rendering:
- Line 446: Sibling invoice status badge
- Line 514: Modal header status badge

## Verification
- [x] `normalizeStatusClass` function exists in app.js
- [x] `window.normalizeStatusClass` is exported for other modules
- [x] CSS has hyphen versions of all underscore status classes
- [x] Invoice cards use normalized status classes
- [x] Modal status badges use normalized status classes
- [x] Backward compatibility maintained (both underscore and hyphen classes work)

## Technical Notes
- The helper function is defined globally to allow use across multiple JS modules
- CSS uses comma-separated selectors to support both old (underscore) and new (hyphen) class names
- modals.js includes a fallback definition in case it loads before app.js
