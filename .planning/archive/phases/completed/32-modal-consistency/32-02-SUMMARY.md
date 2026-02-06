---
phase: 32-modal-consistency
plan: 02
status: complete
completed_at: 2026-01-18
---

# Summary: HTML Modal Structure Standardization

## Objective
Update HTML modal structures to use standardized classes per UI-STANDARDS.md.

## Changes Made

### public/index.html (5 modals updated)

1. **Invoice Detail Modal** (`#invoiceModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

2. **Denial Modal** (`#denialModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

3. **Payment Modal** (`#paymentModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

4. **Universal Upload Modal** (`#universalUploadModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

5. **Split Invoice Modal** (`#splitInvoiceModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

### public/pos.html (1 modal updated)

1. **Confirm Dialog** (`#confirmDialog`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

Note: PO Detail Modal (`#poModal`) already had correct `modal-title-row` structure.

### public/draws.html (8 modals updated)

1. **Draw Detail Modal** (`#drawModal`)
   - Changed `modal-title-group` to `modal-title-row` (standardization)
   - Close button already used `.close-btn` class

2. **Add CO Billing Modal** (`#addCOBillingModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

3. **Fund Draw Modal** (`#fundDrawModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

4. **Submit Draw Modal** (`#submitDrawModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

5. **Unsubmit Modal** (`#unsubmitModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

6. **Auto-Generate Modal** (`#autoGenerateModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

7. **PDF Viewer Modal** (`#pdfViewerModal`)
   - Added `modal-title-row` wrapper around title div
   - Changed inline styled div to `modal-header-actions` class
   - Close button already used `.close-btn` class

8. **Attach Lien Release Modal** (`#attachLienReleaseModal`)
   - Added `modal-title-row` wrapper around `<h2>` in header
   - Close button already used `.close-btn` class

## Verification

| File | modal-title-row Count | close-btn Count |
|------|----------------------|-----------------|
| index.html | 5 | 5 |
| pos.html | 2 | 2 |
| draws.html | 8 | 8 |

All modals now follow the UI-STANDARDS.md modal header pattern:
```html
<div class="modal-header">
  <div class="modal-title-row">
    <h2>Title</h2>
    <span class="status-badge">...</span> <!-- optional -->
  </div>
  <button class="close-btn">&times;</button>
</div>
```

## Notes

- All close buttons were already using the `.close-btn` class (no changes needed)
- Fullscreen modals (`modal-fullscreen-dark`) retain their `modal-header-actions` div for action buttons
- Modal footers were already consistent across all files

## Files Modified
- `public/index.html`
- `public/pos.html`
- `public/draws.html`
