---
phase: 30-ui-audit
plan: 01
status: complete
started: 2026-01-18
completed: 2026-01-18
---

# Summary: 30-01 UI Standards Document

## Objective
Document current UI patterns and establish standards for the v1.5 cleanup.

## Accomplishments

### Task 1: Create UI Standards Document ✓
Created comprehensive `.planning/UI-STANDARDS.md` (755 lines) covering:

1. **CSS Variables** - Full reference of all `:root` variables with usage guidelines
2. **Buttons** - Standard classes (`btn`, `btn-primary`, `btn-secondary`, etc.), sizes, loading states
3. **Badges/Status** - Standardized on `status-badge` with hyphens (not underscores)
4. **Cards** - Three patterns: `summary-card`, `stat-card`, `alert-card` with variants
5. **Tables** - `data-table` as base with `data-table-hover`, `data-table-selectable` modifiers
6. **Modals** - Standard structure with `modal-title-group`, sizes from `modal-sm` to `modal-fullscreen`
7. **Forms** - `form-group`, `form-row`, `form-control` patterns with validation
8. **Toolbars** - Standard `toolbar` with `toolbar-left`, `toolbar-right`
9. **Search** - Standard search box with debouncing and clear button
10. **Loading States** - Skeleton, spinner, empty state patterns

### Task 2: Document Priority Fixes ✓
Added per-page fix checklist covering all 22 HTML pages:

**High Priority Issues Identified:**
- Status class naming inconsistency (underscores vs hyphens)
- Modal header structure varies across pages
- 12+ different table class names need consolidation
- Card systems not unified
- Toolbar naming inconsistent

**Pages Analyzed:** index.html, pos.html, draws.html, bids.html, estimates.html, inspections.html, punch-lists.html, daily-logs.html, budgets.html, dashboard.html, vendors.html, documents.html, schedule.html, photos.html, job-profile.html, price-intelligence.html, cost-codes.html, change-orders.html, lien-releases.html, reconciliation.html

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Keep `g702-table` and `g703-table` | Specialized AIA financial formats, shouldn't be genericized |
| Use hyphens in status classes | CSS convention, consistency with existing patterns |
| Keep three card types | `summary-card`, `stat-card`, `alert-card` serve different purposes |
| Standardize on `data-table` | Consolidate 12+ table class names to one base with modifiers |

## Commits

| Hash | Message |
|------|---------|
| 3d699f3 | docs(30-01): Create UI Standards reference document |

## Files Created/Modified

| File | Action |
|------|--------|
| `.planning/UI-STANDARDS.md` | Created (755 lines) |

## Verification

- [x] .planning/UI-STANDARDS.md exists
- [x] Document has all 10 component sections
- [x] Document has Priority Fixes section
- [x] Each component section has HTML structure examples
- [x] CSS variable reference is complete

## Next Phase Readiness

Phase 31 (Component Uniformity) can proceed using UI-STANDARDS.md as the reference for:
- Button standardization across all pages
- Badge/status class updates (underscores → hyphens)
- Input/form control consistency

The standards document provides clear targets for each subsequent phase.
