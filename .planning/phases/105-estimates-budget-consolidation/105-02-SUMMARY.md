# Phase 105 Plan 02: Navigation and Redirects Summary

## One-liner
Consolidated navigation to single Estimates & Budgets link with redirect stubs for old URLs.

## What Was Built

### Navigation Consolidation
- Updated `nav-sidebar.js` Pre-Construction group
- Replaced two separate links (Estimates, Budget Builder) with single "Estimates & Budgets" link
- Link points to new unified `estimates-budget.html` page

### Redirect Stubs
1. **estimates.html** - Minimal redirect page
   - Meta refresh for immediate redirect
   - JavaScript redirect preserving query parameters
   - Fallback link for no-JS browsers

2. **budget-builder.html** - Redirect with budget mode
   - Sets `localStorage.estimatesBudgetMode = 'budget'`
   - Adds `?mode=budget` query parameter
   - Preserves existing query params

## Files Modified

| File | Change |
|------|--------|
| `public/js/nav-sidebar.js` | Replaced estimates + budget-builder links with estimates-budget |
| `public/estimates.html` | Converted to redirect stub (15 lines) |
| `public/budget-builder.html` | Converted to redirect stub with mode=budget (18 lines) |

## Verification

- [x] Navigation shows single "Estimates & Budgets" link
- [x] /estimates.html redirects to /estimates-budget.html
- [x] /budget-builder.html redirects to /estimates-budget.html?mode=budget
- [x] Query parameters preserved during redirects

## Commit

`9f12f64` - feat(105-02,105-03): navigation consolidation and URL mode handling
