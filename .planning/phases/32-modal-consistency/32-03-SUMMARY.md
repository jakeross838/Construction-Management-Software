# Plan 32-03 Summary: JavaScript Modal Builders Update

## Objective
Update JavaScript modal builders to generate consistent markup matching the standardized modal patterns.

## Changes Made

### 1. public/js/modals.js

Updated 12 modal generation patterns:

| Modal | Changes |
|-------|---------|
| Invoice View/Edit Modal | Changed `modal-title` to `modal-title-row`, `modal-close` to `close-btn` |
| Create Change Order Modal | Added `modal-title-row` wrapper, changed `modal-close` to `close-btn` |
| Create Purchase Order Modal | Added `modal-title-row` wrapper, changed `modal-close` to `close-btn` |
| Link to Change Order Prompt | Added `modal-title-row` wrapper, changed `modal-close` to `close-btn` |
| Partial Approval Dialog | Added `modal-title-row` wrapper, changed `modal-close` to `close-btn` |
| Send Back for Review Dialog | Added `modal-title-row` wrapper, changed `modal-close` to `close-btn` |
| Deny Invoice Dialog | Added `modal-title-row` wrapper, changed `modal-close` to `close-btn` |
| Close Out Invoice Dialog | Added `modal-title-row` wrapper, changed `modal-close` to `close-btn` |
| Job Selection Modal | Added `modal-title-row` wrapper, changed `modal-close` to `close-btn` |
| Confirm Dialog | Added `modal-title-row` wrapper, changed `modal-close` to `close-btn` |
| Link Picker (2 instances) | Changed `modal-close` to `close-btn` |

### 2. public/js/po-modals.js

Updated 1 modal generation pattern:

| Modal | Changes |
|-------|---------|
| Create CO for Line Item Modal | Added `modal-title-row` wrapper, changed `modal-close` to `close-btn` |

### 3. public/draws.html (No changes needed)

The draws.html file already uses the correct patterns:
- All modals use `modal-title-row` class
- All close buttons use `close-btn` class
- No dynamically generated modal markup in JavaScript

## Verification

### modals.js
- 10 instances of `modal-title-row` in template strings
- 12 instances of `close-btn` in template strings
- 0 instances of deprecated `modal-close` class
- 0 instances of deprecated `modal-title` (without -row)

### po-modals.js
- 1 instance of `modal-title-row` in template strings
- 1 instance of `close-btn` in template strings
- 0 instances of deprecated patterns

### draws.html
- Static HTML already compliant
- JavaScript updates content within modals, not modal structure

## Standard Pattern Applied

```html
<div class="modal-header">
  <div class="modal-title-row">
    <h2>Modal Title</h2>
    <!-- Optional: status badge, additional info -->
  </div>
  <button class="close-btn" onclick="closeModal()">&times;</button>
</div>
```

## Files Modified
- `public/js/modals.js` - 12 modal patterns updated
- `public/js/po-modals.js` - 1 modal pattern updated

## Testing Notes
- All dynamically generated modals now follow consistent structure
- Backward compatible with existing CSS (both `modal-title-row` and `modal-title-group` are aliased in CSS)
- No changes to modal functionality, only markup structure

## Completion Status
- [x] modals.js uses modal-title-row in generated HTML
- [x] po-modals.js uses modal-title-row in generated HTML
- [x] Draw modal code uses modal-title-row (already compliant)
- [x] All close buttons use close-btn class
- [x] No JavaScript errors expected

---
*Completed: 2026-01-18*
