# UI Standards Reference - Ross Built CMS

This document defines the standard UI patterns for v1.5 cleanup. All components should follow these specifications.

---

## 1. CSS Variables

All styling must use CSS variables from `:root`. Never hardcode colors.

### Core Palette
| Variable | Value | Usage |
|----------|-------|-------|
| `--background` | #f5f3ef | Page background |
| `--foreground` | #2d2a26 | Primary text |
| `--card` | #faf9f6 | Card/panel backgrounds |
| `--card-elevated` | #f0eee9 | Elevated card backgrounds |
| `--border` | #ddd9d2 | Standard borders |
| `--border-light` | #e5e2db | Light borders |

### Primary Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--primary` | #3b6fd4 | Primary actions, links |
| `--primary-hover` | #2f5bb8 | Primary hover state |
| `--primary-foreground` | #ffffff | Text on primary |

### Secondary/Muted
| Variable | Value | Usage |
|----------|-------|-------|
| `--secondary` | #eae7e1 | Secondary backgrounds |
| `--muted` | #e8e5df | Muted backgrounds |
| `--muted-foreground` | #78716c | Secondary text |

### Status Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--success` / `--approved` | #16a34a | Success, approved |
| `--warning` / `--needs-approval` | #d97706 | Warning, pending |
| `--destructive` / `--denied` | #dc2626 | Error, danger, denied |
| `--info` / `--paid` | #2563eb | Info, completed |
| `--in-draw` | #7c3aed | Purple, in-progress |
| `--received` | #6b7280 | Gray, received |

### Spacing Scale
| Variable | Value | Usage |
|----------|-------|-------|
| `--space-xs` | 0.25rem (4px) | Tight spacing |
| `--space-sm` | 0.5rem (8px) | Small gaps |
| `--space-md` | 0.75rem (12px) | Medium gaps |
| `--space-lg` | 1rem (16px) | Standard spacing |
| `--space-xl` | 1.5rem (24px) | Large spacing |
| `--space-2xl` | 2rem (32px) | Section spacing |

### Border Radius
| Variable | Value | Usage |
|----------|-------|-------|
| `--radius-sm` | 4px | Small elements |
| `--radius` / `--radius-md` | 6px | Default radius |
| `--radius-lg` | 8px | Cards, modals |
| `--radius-xl` | 12px | Large cards |
| `--radius-full` | 9999px | Pills, circles |

### Shadows
| Variable | Value | Usage |
|----------|-------|-------|
| `--shadow-sm` | 0 1px 2px rgba(0,0,0,0.05) | Subtle |
| `--shadow` | 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05) | Default |
| `--shadow-lg` | 0 4px 16px rgba(0,0,0,0.1) | Elevated |
| `--shadow-card` | 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06) | Cards |

### Z-Index Scale
| Variable | Value | Usage |
|----------|-------|-------|
| `--z-dropdown` | 100 | Dropdowns |
| `--z-sticky` | 200 | Sticky headers |
| `--z-modal-backdrop` | 1000 | Modal overlay |
| `--z-modal` | 1001 | Modal content |
| `--z-toast` | 2000 | Toast notifications |
| `--z-tooltip` | 3000 | Tooltips |

---

## 2. Buttons

### Standard Button Classes

```html
<!-- Primary action -->
<button class="btn btn-primary">Save Changes</button>

<!-- Secondary/Cancel -->
<button class="btn btn-secondary">Cancel</button>

<!-- Danger/Delete -->
<button class="btn btn-danger">Delete</button>

<!-- Success/Confirm -->
<button class="btn btn-success">Approve</button>

<!-- Warning -->
<button class="btn btn-warning">Archive</button>

<!-- Ghost (subtle) -->
<button class="btn btn-ghost">More Options</button>

<!-- Outline -->
<button class="btn btn-outline">Export</button>
```

### Size Variants

```html
<!-- Small (toolbar, table rows) -->
<button class="btn btn-primary btn-sm">Edit</button>

<!-- Default -->
<button class="btn btn-primary">Submit</button>

<!-- Large (hero actions) -->
<button class="btn btn-primary btn-lg">Create Project</button>
```

### Button with Icon

```html
<button class="btn btn-primary">
  <svg>...</svg>
  Add Item
</button>
```

### Loading State

```html
<button class="btn btn-primary btn-loading">Saving...</button>
```

### Anti-Patterns to Avoid
- ❌ `class="button"` - Use `btn`
- ❌ Inline styles for colors
- ❌ Custom padding - Use size variants
- ❌ `btn-icon` without icon content

---

## 3. Badges & Status Indicators

### Standard Status Badge

```html
<span class="status-badge status-approved">Approved</span>
<span class="status-badge status-pending">Pending</span>
<span class="status-badge status-denied">Denied</span>
<span class="status-badge status-draft">Draft</span>
<span class="status-badge status-in-draw">In Draw</span>
<span class="status-badge status-paid">Paid</span>
<span class="status-badge status-received">Received</span>
```

### Status Class Naming Convention

**STANDARD:** Use hyphens, not underscores.

| Status | Class |
|--------|-------|
| Needs Approval | `status-needs-approval` |
| In Draw | `status-in-draw` |
| Ready for Approval | `status-ready-for-approval` |

### Stat Chip (for metrics)

```html
<div class="stat-chip">
  <span class="stat-chip-value">24</span>
  <span class="stat-chip-label">Total</span>
</div>

<div class="stat-chip stat-chip-success">
  <span class="stat-chip-value">18</span>
  <span class="stat-chip-label">Approved</span>
</div>
```

Variants: `stat-chip-success`, `stat-chip-warning`, `stat-chip-info`, `stat-chip-accent`

### Anti-Patterns to Avoid
- ❌ `status-needs_approval` (underscore) - Use `status-needs-approval`
- ❌ Multiple badge systems on same page
- ❌ Hardcoded colors in badges

---

## 4. Cards

### Standard Card Structure

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Title</h3>
    <span class="card-subtitle">Subtitle</span>
  </div>
  <div class="card-body">
    Content here
  </div>
  <div class="card-footer">
    <button class="btn btn-secondary">Cancel</button>
    <button class="btn btn-primary">Save</button>
  </div>
</div>
```

### Summary Card (for key metrics)

```html
<div class="summary-card">
  <div class="summary-label">Total Amount</div>
  <div class="summary-value">$45,000</div>
</div>

<div class="summary-card highlight">
  <div class="summary-label">This Period</div>
  <div class="summary-value">$12,500</div>
</div>
```

### Stat Card (for dashboard)

```html
<div class="stat-card">
  <div class="stat-card-icon blue">📊</div>
  <div class="stat-card-content">
    <span class="stat-card-value">42</span>
    <span class="stat-card-label">Active Projects</span>
  </div>
</div>
```

Icon colors: `blue`, `green`, `orange`, `red`, `purple`

### Alert Card

```html
<div class="alert-card alert-warning">
  <div class="alert-card-icon">⚠️</div>
  <div class="alert-card-content">
    <div class="alert-card-title">Budget Warning</div>
    <div class="alert-card-message">3 items over budget</div>
  </div>
</div>
```

Variants: `alert-warning`, `alert-danger`, `alert-info`, `alert-success`

### Anti-Patterns to Avoid
- ❌ Mixing card systems on same page
- ❌ Cards without proper semantic structure
- ❌ Inline margin/padding overrides

---

## 5. Tables

### Standard Data Table

```html
<div class="data-table-container">
  <table class="data-table data-table-hover">
    <thead>
      <tr>
        <th>Name</th>
        <th>Status</th>
        <th>Amount</th>
        <th class="col-actions">Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Item Name</td>
        <td><span class="status-badge status-approved">Approved</span></td>
        <td>$1,234.00</td>
        <td class="col-actions">
          <button class="btn btn-sm btn-ghost">Edit</button>
          <button class="btn btn-sm btn-ghost">Delete</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Table Variants

| Class | Usage |
|-------|-------|
| `data-table` | Base table styling |
| `data-table-hover` | Row hover effect |
| `data-table-selectable` | With checkboxes |
| `data-table-compact` | Reduced padding |

### Empty State

```html
<div class="empty-state">
  <div class="empty-state-icon">📋</div>
  <div class="empty-state-title">No items found</div>
  <div class="empty-state-message">Create your first item to get started</div>
  <button class="btn btn-primary">Add Item</button>
</div>
```

### Anti-Patterns to Avoid
- ❌ `invoices-table`, `budget-table`, `g703-table` - Use `data-table` with modifiers
- ❌ Inline action buttons with different styles
- ❌ Tables without container wrapper

---

## 6. Modals

### Standard Modal Structure

```html
<div id="myModal" class="modal">
  <div class="modal-content modal-md">
    <div class="modal-header">
      <div class="modal-title-group">
        <h2>Modal Title</h2>
        <span class="status-badge status-draft">Draft</span>
      </div>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      Content here
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </div>
</div>
```

### Modal Sizes

| Class | Width | Usage |
|-------|-------|-------|
| `modal-sm` | 400px | Confirmations, quick forms |
| `modal-md` | 600px | Standard forms |
| `modal-lg` | 800px | Detail views |
| `modal-xl` | 1000px | Complex forms |
| `modal-fullscreen` | 100% | Fullscreen overlays |

### Modal with Tabs

```html
<div class="modal-content modal-lg">
  <div class="modal-header">
    <h2>Details</h2>
    <button class="close-btn">&times;</button>
  </div>
  <div class="tabs">
    <button class="tab active" data-tab="overview">Overview</button>
    <button class="tab" data-tab="details">Details</button>
    <button class="tab" data-tab="history">History</button>
  </div>
  <div class="modal-body">
    <div id="tab-overview" class="tab-content active">...</div>
    <div id="tab-details" class="tab-content">...</div>
    <div id="tab-history" class="tab-content">...</div>
  </div>
</div>
```

### Modal Footer with Delete

```html
<div class="modal-footer">
  <button class="btn btn-danger" style="margin-right: auto;">Delete</button>
  <button class="btn btn-secondary">Cancel</button>
  <button class="btn btn-primary">Save</button>
</div>
```

### Opening/Closing Modals (CRITICAL)

```javascript
// OPEN - Must add .show class for visibility
function openModal(id) {
  const modal = document.getElementById(id);
  modal.style.display = 'flex';
  modal.classList.add('show');  // REQUIRED!
}

// CLOSE - Remove .show before hiding
function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('show');
  modal.style.display = 'none';
}
```

### Anti-Patterns to Avoid
- ❌ Missing `.show` class (modal invisible)
- ❌ Different header structures per modal
- ❌ `modal-fullscreen-dark` without proper content structure

---

## 7. Forms

### Standard Form Group

```html
<div class="form-group">
  <label for="name">Name <span class="required">*</span></label>
  <input type="text" id="name" class="form-control" required>
</div>
```

### Form Row (Multiple Fields)

```html
<div class="form-row">
  <div class="form-group">
    <label for="first">First Name</label>
    <input type="text" id="first" class="form-control">
  </div>
  <div class="form-group">
    <label for="last">Last Name</label>
    <input type="text" id="last" class="form-control">
  </div>
</div>
```

### Form Controls

```html
<!-- Text input -->
<input type="text" class="form-control">

<!-- Small input -->
<input type="text" class="form-control form-control-sm">

<!-- Textarea -->
<textarea class="form-control" rows="3"></textarea>

<!-- Select -->
<select class="form-control">
  <option value="">Select...</option>
</select>
```

### Form Section Divider

```html
<div class="form-section-divider">Contact Information</div>
<div class="form-row">...</div>
```

### Validation Error

```html
<div class="form-group has-error">
  <label for="email">Email</label>
  <input type="email" id="email" class="form-control">
  <span class="form-error">Please enter a valid email</span>
</div>
```

### Anti-Patterns to Avoid
- ❌ Inline width styles on form-group
- ❌ Different input classes per page
- ❌ Labels without `for` attribute

---

## 8. Toolbars

### Standard Toolbar

```html
<div class="toolbar">
  <div class="toolbar-left">
    <div class="search-box">
      <input type="text" class="form-control search-input" placeholder="Search...">
      <button class="search-clear-btn">&times;</button>
    </div>
    <select class="form-control form-control-sm filter-select">
      <option value="">All Status</option>
    </select>
  </div>
  <div class="toolbar-right">
    <button class="btn btn-primary">Add New</button>
  </div>
</div>
```

### Batch Operations Toolbar

```html
<div class="batch-toolbar" id="batchToolbar" style="display: none;">
  <span class="batch-count">3 selected</span>
  <button class="btn btn-sm btn-secondary">Approve All</button>
  <button class="btn btn-sm btn-danger">Delete All</button>
  <button class="btn btn-sm btn-ghost" onclick="clearSelection()">Cancel</button>
</div>
```

### View Toggle (Table/Cards)

```html
<div class="view-toggle">
  <button class="view-btn active" data-view="table" onclick="setView('table')">
    <svg><!-- table icon --></svg>
  </button>
  <button class="view-btn" data-view="cards" onclick="setView('cards')">
    <svg><!-- grid icon --></svg>
  </button>
</div>
```

### Anti-Patterns to Avoid
- ❌ `table-toolbar` vs `data-toolbar` - Use `toolbar`
- ❌ Search boxes without clear button
- ❌ Inconsistent filter positioning

---

## 9. Search

### Standard Search Box

```html
<div class="search-box">
  <input type="text"
         id="searchInput"
         class="form-control search-input"
         placeholder="Search...">
  <button class="search-clear-btn"
          id="searchClear"
          style="display: none;"
          onclick="clearSearch()">&times;</button>
</div>
```

### Search with Icon

```html
<div class="search-box search-box-icon">
  <span class="search-icon">🔍</span>
  <input type="text" class="form-control search-input" placeholder="Search...">
  <button class="search-clear-btn">&times;</button>
</div>
```

### Search JavaScript Pattern

```javascript
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');

let debounceTimer;
searchInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  searchClear.style.display = e.target.value ? 'block' : 'none';
  debounceTimer = setTimeout(() => {
    filterItems(e.target.value);
  }, 150);
});

function clearSearch() {
  searchInput.value = '';
  searchClear.style.display = 'none';
  filterItems('');
}
```

### Anti-Patterns to Avoid
- ❌ Search without debouncing
- ❌ Missing clear button
- ❌ Different search patterns per page

---

## 10. Loading States

### Skeleton Loading

```html
<div class="skeleton-card">
  <div class="skeleton skeleton-title"></div>
  <div class="skeleton skeleton-text"></div>
  <div class="skeleton skeleton-text"></div>
</div>
```

### Spinner

```html
<div class="spinner"></div>

<!-- In button -->
<button class="btn btn-primary btn-loading">Loading...</button>
```

### Full Page Loading

```html
<div class="loading-overlay">
  <div class="spinner"></div>
  <span>Loading...</span>
</div>
```

### Empty State (no data)

```html
<div class="empty-state">
  <div class="empty-state-icon">📋</div>
  <div class="empty-state-title">No items found</div>
  <div class="empty-state-message">Try adjusting your filters</div>
</div>
```

### Anti-Patterns to Avoid
- ❌ Different loading patterns per page
- ❌ No loading state during API calls
- ❌ Spinner without container

---

## 11. Priority Fixes by Page

### High Priority (Multiple Pages)

| Issue | Current | Standard | Affected Pages |
|-------|---------|----------|----------------|
| Status class naming | `status-needs_approval` | `status-needs-approval` | index.html, pos.html, draws.html |
| Modal header structure | Multiple patterns | `modal-title-group` | All pages with modals |
| Table class names | `invoices-table`, `g703-table` | `data-table` variants | budgets.html, draws.html, index.html |
| Card class unification | `summary-card`, `stat-card`, `alert-card` | Keep separate but consistent | dashboard.html, budgets.html |
| Toolbar naming | `table-toolbar`, `data-toolbar` | `toolbar` | All list pages |

### Per-Page Fixes

#### index.html (Invoices)
- [ ] Convert `invoices-table` to `data-table`
- [ ] Standardize modal header to `modal-title-group`
- [ ] Update status classes (underscores to hyphens)

#### pos.html (Purchase Orders)
- [ ] Standardize modal structure
- [ ] Update toolbar class names

#### draws.html (Draws)
- [ ] Keep `g702-table` and `g703-table` (specialized financial formats)
- [ ] Standardize regular data tables
- [ ] Update modal headers

#### bids.html (Bids)
- [ ] Already uses `data-table` - good
- [ ] Standardize search box pattern
- [ ] View toggle is good - replicate elsewhere if needed

#### estimates.html
- [ ] Convert `worksheet-table` to `data-table data-table-compact`
- [ ] Standardize card patterns

#### inspections.html
- [ ] Standardize modal footer pattern
- [ ] Update stat-chip usage

#### punch-lists.html
- [ ] Standardize form patterns
- [ ] Update button styles

#### daily-logs.html
- [ ] Standardize form-row flex patterns
- [ ] Update card structures

#### budgets.html
- [ ] Keep specialized budget visualization
- [ ] Standardize section headers

#### dashboard.html
- [ ] Standardize stat-card patterns
- [ ] Update alert-card patterns

#### vendors.html
- [ ] Standardize table actions
- [ ] Update modal patterns

#### documents.html
- [ ] Standardize table patterns
- [ ] Update version badge styles

#### schedule.html
- [ ] Keep Gantt-specific styling
- [ ] Standardize toolbar

#### photos.html
- [ ] Standardize gallery patterns
- [ ] Update modal for lightbox

#### job-profile.html
- [ ] Standardize stat-card patterns
- [ ] Update section layouts

#### price-intelligence.html
- [ ] Newly added - verify follows standards
- [ ] Category sidebar is unique, document pattern

#### cost-codes.html
- [ ] Update badge patterns
- [ ] Standardize table actions

#### change-orders.html
- [ ] Standardize form patterns
- [ ] Update modal structure

#### lien-releases.html
- [ ] Standardize table patterns
- [ ] Update status badges

#### reconciliation.html
- [ ] Convert `history-table` to `data-table`
- [ ] Standardize toolbar

---

## Implementation Notes

### Phase 31: Component Uniformity
Focus on: Buttons, badges, inputs across all pages

### Phase 32: Modal Consistency
Focus on: Modal structure, headers, footers, tabs

### Phase 33: Tables & Lists
Focus on: Table classes, row actions, empty states

### Phase 34: Forms & Validation
Focus on: Form layout, error display, input styling

### Phase 35: Navigation & Layout
Focus on: Sidebar, headers, page structure

### Phase 36: Polish & Final Pass
Focus on: Transitions, spacing, cross-browser testing

---

*Last updated: 2026-01-18*
