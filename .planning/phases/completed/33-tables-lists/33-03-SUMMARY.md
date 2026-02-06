# Plan 33-03 Summary: Table Standardization - Budget, Reconciliation, Price Intelligence

## Overview
Updated HTML pages to use standardized table classes and patterns as defined in UI-STANDARDS.md.

## Files Modified

### 1. public/budgets.html

**Changes Made:**
- Converted Change Orders table from `invoices-table` to `data-table data-table-hover`
- Added `data-table-container` wrapper around CO table
- Added `col-actions` class to Actions column header
- Converted Cost Code Detail modal tables (Invoices and POs) from `invoices-table` to `data-table data-table-hover`
- Added `data-table-container` wrappers around modal tables

**Empty States Standardized:**
- Initial "No Job Selected" state - added icon, title, message structure
- Budget loading error state - added standard empty state structure
- No budget lines state - added standard empty state structure
- No change orders state - added standard empty state structure
- No linked invoices state - added standard empty state structure
- Cost code detail: No invoices state - added standard empty state structure
- Cost code detail: No purchase orders state - added standard empty state structure

**Preserved:**
- `g703-table` class for financial budget table (specialized formatting required)
- `budget-table` modifier for budget-specific styling

### 2. public/reconciliation.html

**Changes Made:**
- Added `data-table data-table-hover` classes alongside existing `history-table` class
- Added `data-table-container` wrapper around history table
- Added `col-actions` class to Resolution column header

**Empty States Standardized:**
- No reconciliation history state - added icon, title, message structure

**Preserved:**
- `history-table` class for backward compatibility with existing page-specific CSS
- Page-specific styles in `<style>` block for reconciliation-specific layout

### 3. public/price-intelligence.html

**Changes Made:**
- Converted all `invoices-table` classes to `data-table data-table-hover` (9 tables total)
- Changed `data-toolbar` class to standard `toolbar` class
- Updated CSS override from `.data-toolbar .view-toggle` to `.toolbar .view-toggle`
- Changed `search-input-wrap` to `search-box` for search container
- Added `data-table-container` wrappers around all tables:
  - Item Prices table
  - Item History table
  - Item Aliases table
  - Recent Savings table
  - Top Vendors table
  - Spend by Category table

**Empty States Standardized:**
- No savings data state - added icon, title, message structure

## Verification

### budgets.html
- [x] CO table uses `data-table data-table-hover` classes
- [x] Action column has `col-actions` class
- [x] Empty states follow standard structure with icon, title, message
- [x] `g703-table` preserved for budget lines (specialized financial table)

### reconciliation.html
- [x] History table has `data-table data-table-hover` classes
- [x] Resolution column has `col-actions` class
- [x] Empty states follow standard structure
- [x] `history-table` class preserved for backward compatibility

### price-intelligence.html
- [x] All tables use `data-table data-table-hover` classes
- [x] Toolbar uses standard `.toolbar` class
- [x] Search uses `.search-box` container
- [x] Empty states follow standard structure
- [x] All tables wrapped in `data-table-container`

## Notes

1. **Specialized Tables Preserved**: The `g703-table` class in budgets.html was intentionally preserved as it provides specialized financial formatting for AIA G703 Schedule of Values display.

2. **Backward Compatibility**: The `history-table` class was kept alongside the new `data-table` classes in reconciliation.html to maintain compatibility with page-specific CSS styling.

3. **Empty State Pattern**: All empty states now follow the standard structure:
   ```html
   <tr class="empty-row">
     <td colspan="X" class="empty-state">
       <div class="empty-state-icon">ICON</div>
       <div class="empty-state-title">Title</div>
       <div class="empty-state-message">Description</div>
     </td>
   </tr>
   ```

4. **Table Container Pattern**: All data tables are now wrapped in `<div class="data-table-container">` for proper overflow handling and styling consistency.

## Completed
- Date: 2026-01-18
- Phase: 33-tables-lists
- Plan: 03
