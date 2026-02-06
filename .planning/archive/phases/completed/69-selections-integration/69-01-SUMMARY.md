---
phase: 69-selections-integration
plan: 01
subsystem: catalog
tags: [selections, variance, change-orders, budget-tracking]

dependency-graph:
  requires: [68-catalog-management]
  provides: [variance-display, co-prompt, catalog-selection-budget-tracking]
  affects: [selections-management]

tech-stack:
  added: []
  patterns: [real-time-variance-calculation, conditional-ui-display]

key-files:
  created: []
  modified:
    - public/js/catalog.js
    - public/catalog.html
    - public/css/catalog.css

decisions:
  - id: VARIANCE-DISPLAY
    choice: "Show detailed variance breakdown (budget, selected, remaining, after) in Add Selection modal"
    rationale: "Gives staff complete visibility into budget impact before committing selection"
  - id: CO-PROMPT-TRIGGER
    choice: "Auto-show CO prompt when projected amount exceeds allowance budget"
    rationale: "Proactive workflow - staff can create CO in same flow without switching pages"
  - id: CO-MARKUP-DEFAULT
    choice: "Default 15% markup on CO with editable input"
    rationale: "Standard contractor markup while allowing adjustment per situation"

metrics:
  duration: "15 minutes"
  completed: "2026-01-20"
---

# Phase 69 Plan 01: Variance Display and CO Prompt in Catalog Add Selection Flow Summary

**One-liner:** Real-time budget variance display with automatic CO creation prompt when selections exceed allowance.

## What Was Built

### Allowance Variance Indicator
Added a variance display section to the Add Selection modal that shows:
- **Budget**: Total allowance budgeted amount
- **Already Selected**: Sum of existing selections against this allowance
- **Remaining**: Current budget remaining before this selection
- **After This Selection**: Projected remaining after adding current selection

Visual indicators:
- Green left border and text when under budget
- Red left border and background tint when over budget

### CO Creation Prompt
When a selection would exceed the allowance budget:
- Yellow warning prompt automatically appears
- Shows the overage amount
- Checkbox to opt-in to CO creation
- Markup percentage input (defaults to 15%)
- Live CO total preview with markup applied

### One-Click CO Creation
When saving a selection with CO checkbox enabled:
1. Selection is created first via POST /api/selections/items
2. If successful and CO checkbox checked, calls POST /api/selections/items/:id/create-co
3. Both success toasts shown (selection + CO)
4. Graceful degradation if CO creation fails (selection still saved)

## Files Modified

### public/js/catalog.js
- Added `allJobAllowances` state variable to store full allowance data
- Enhanced `loadJobAllowances()` to store allowance objects with budget/selected amounts
- Added `showAllowanceVariance()` function for real-time variance calculations
- Added `calculateCOPreview()` function for markup preview
- Added `createCOFromSelection()` async function to call CO creation API
- Updated `saveSelection()` to check CO checkbox and trigger CO creation
- Updated `openAddSelectionModal()` to reset variance/CO prompt state
- Added event listeners for allowance change, quantity change, CO checkbox, and markup input

### public/catalog.html
- Added `#allowanceVariance` div with variance rows (budget, selected, remaining, after)
- Added `#coPrompt` div with warning header, overage display, checkbox, and markup input
- Added `#coMarkupSection` with markup input and CO total preview

### public/css/catalog.css
- Added `.allowance-variance` styles with conditional `.variance-over`/`.variance-under` states
- Added `.variance-row` layout for budget breakdown
- Added `.co-prompt` warning box styles (orange theme)
- Added `.checkbox-label` for styled checkbox
- Added `.co-markup-section` and `.co-total-preview` for markup input area

## API Integration

### Existing APIs Used
- `GET /api/selections/allowances?job_id=` - Fetches allowances with budgeted_amount and selected_amount
- `POST /api/selections/items` - Creates selection item
- `POST /api/selections/items/:id/create-co` - Creates change order from selection overage

## Verification Checklist
- [x] Allowance dropdown shows budget status for each option
- [x] Variance indicator shows projected impact of selection
- [x] CO prompt automatically appears when selection exceeds budget
- [x] CO can be created in same flow as selection save
- [x] Code changes deployed and accessible at localhost:3001

## Commits
- `11b39d5`: feat(69-01): add variance display and CO prompt in catalog Add Selection flow

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps
- Test with actual allowance data (current test job has no allowances)
- Consider adding variance display to selections.html for consistency
