# Phase 110: Estimating UI/UX Overhaul - Research

**Researched:** 2026-01-22
**Domain:** UI/UX Design, Inline Editing, Responsive Tables, Workflow Patterns
**Confidence:** MEDIUM-HIGH

## Summary

This research addresses the user's core complaint: "It should be simple and effective" - the estimating interface has accumulated clutter over multiple phases and needs streamlining. The audit of `estimates-budget.html` reveals **54 distinct onclick handlers**, multiple overlapping modals, and features that exist but aren't connected (many show "coming soon" toasts).

The standard approach for construction estimating software follows a **progressive disclosure pattern**: show only what's needed for the current task, hide complexity until requested. Competitors like Buildxact succeed by keeping interfaces simple and focused, while CoConstruct struggles with a "dated interface" that slows adoption.

**Primary recommendation:** Remove or hide 60% of buttons/features, implement inline editing for the line items table, add a clear 4-step workflow indicator (Create -> Build -> Review -> Send), and adopt a mobile-first card layout for tablet/field use.

## Standard Stack

### Core (No new libraries needed)
| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Vanilla JS | ES6+ | Inline editing, event handling | Already in use, no framework overhead |
| CSS Custom Properties | CSS3 | Theme consistency | Already established in styles.css |
| contenteditable | HTML5 | Inline text editing | Native, lightweight, well-supported |

### Supporting (Already present)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing modal system | N/A | Complex edits | Only for multi-field forms |
| Toast system | N/A | Feedback | Quick confirmations |
| Tab system | N/A | Organize related content | Section switching within modals |

### What NOT to Add
| Problem | Don't Use | Why Not |
|---------|-----------|---------|
| Inline editing | External library (x-editable, etc.) | Simple vanilla JS sufficient, reduces dependencies |
| State management | Redux/Zustand/etc. | App is form-based, not SPA - DOM is the state |
| Component framework | React/Vue | Would require full rewrite, vanilla JS is working |

**Installation:** No new packages needed - pure CSS/JS improvements.

## Architecture Patterns

### Recommended Information Architecture

**Current State (Problematic):**
```
estimates-budget.html
  Mode: Estimates (default) | Budget Builder
    Estimates Mode:
      - Header with 2 primary buttons
      - Stats bar (5 stats)
      - Toolbar (filters, search, view toggle, column settings, import)
      - Table/Card view
      - Detail Modal (fullscreen, 4 tabs):
        - Overview (many actions)
        - Line Items (complex worksheet)
        - Versions
        - Activity
    Budget Mode:
      - Different header, stats, actions
      - Complex comparison table
```

**Recommended State (Simplified):**
```
estimates-budget.html
  Workflow Stepper: [Create] -> [Build] -> [Review] -> [Send]

  Create Step:
    - Job selection (if not selected)
    - Title input
    - Optional: import from template/bid

  Build Step (Primary Focus):
    - Inline-editable line items table
    - Minimal toolbar (add item, totals only)
    - Right sidebar (cost library) - collapsible

  Review Step:
    - Read-only view of estimate
    - Markup/contingency adjustment
    - Summary totals

  Send Step:
    - Preview as client sees it
    - Send to client button
    - Download PDF option
```

### Pattern 1: Progressive Disclosure
**What:** Hide complexity until user needs it
**When to use:** Data-dense interfaces with multiple features
**Example:**
```html
<!-- BAD: All actions visible at once -->
<div class="toolbar">
  <button>Add Item</button>
  <button>Templates</button>
  <button>AI Scope</button>
  <button>Import from Bid</button>
  <button>Column Settings</button>
  <button>Cost Library</button>
  <button>Group Items</button>
  <button>Export</button>
</div>

<!-- GOOD: Primary action prominent, others in menu -->
<div class="toolbar">
  <button class="btn-primary">+ Add Item</button>
  <div class="dropdown">
    <button class="btn-icon">...</button>
    <menu>
      <item>Import from template</item>
      <item>Import from bid</item>
      <item>AI Scope Analysis</item>
    </menu>
  </div>
</div>
```

### Pattern 2: Inline Editing with Click-to-Edit
**What:** Click on a cell to edit, Enter/Tab to save, Escape to cancel
**When to use:** Spreadsheet-like data entry (line items table)
**Example:**
```javascript
// Source: PatternFly Inline Edit Guidelines, CSS-Tricks contenteditable patterns
function makeEditable(cell) {
  const originalValue = cell.textContent;
  cell.contentEditable = true;
  cell.focus();

  // Select all text on focus
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(cell);
  selection.removeAllRanges();
  selection.addRange(range);

  // Save on Enter or blur
  const save = () => {
    cell.contentEditable = false;
    if (cell.textContent !== originalValue) {
      saveToServer(cell.dataset.field, cell.textContent);
    }
  };

  // Cancel on Escape
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
      // Move to next cell
      const nextCell = getNextEditableCell(cell);
      if (nextCell) makeEditable(nextCell);
    } else if (e.key === 'Escape') {
      cell.textContent = originalValue;
      cell.contentEditable = false;
    } else if (e.key === 'Tab') {
      e.preventDefault();
      save();
      const direction = e.shiftKey ? 'prev' : 'next';
      const targetCell = getAdjacentCell(cell, direction);
      if (targetCell) makeEditable(targetCell);
    }
  });

  cell.addEventListener('blur', save, { once: true });
}
```

### Pattern 3: Workflow Stepper
**What:** Visual progress indicator showing current step in multi-step process
**When to use:** Linear workflows with 3-5 distinct phases
**Example:**
```html
<!-- Source: PatternFly Progress Stepper, USWDS Step Indicator -->
<div class="workflow-stepper">
  <div class="step completed" data-step="create">
    <span class="step-number">1</span>
    <span class="step-label">Create</span>
  </div>
  <div class="step-connector completed"></div>
  <div class="step current" data-step="build">
    <span class="step-number">2</span>
    <span class="step-label">Build</span>
  </div>
  <div class="step-connector"></div>
  <div class="step" data-step="review">
    <span class="step-number">3</span>
    <span class="step-label">Review</span>
  </div>
  <div class="step-connector"></div>
  <div class="step" data-step="send">
    <span class="step-number">4</span>
    <span class="step-label">Send</span>
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Modal for every edit:** Current system requires modal to edit line items. Use inline editing instead.
- **Too many tabs:** Detail modal has 4 tabs - most users only need Line Items. Flatten structure.
- **Dual-mode confusion:** "Estimates" vs "Budget" mode switcher adds cognitive load. Consider separate pages or clearer separation.
- **Stats overload:** 5 stat chips + 4 budget stat cards + coverage bar = information overload. Pick 2-3 key metrics.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency input formatting | Custom parsing/formatting | `Intl.NumberFormat` + input pattern | Edge cases with decimals, negatives |
| Keyboard navigation grid | Manual cell tracking | HTML `tabindex` + CSS Grid | Accessibility built-in |
| Mobile detection | Custom viewport checks | CSS media queries + `matchMedia` | Browser handles breakpoints |
| Debounced autosave | Custom timers | Simple debounce wrapper (already exists) | Consistent timing |

**Key insight:** The current codebase already has `debounceTimer` and utility functions. Reuse them rather than creating new patterns.

## Common Pitfalls

### Pitfall 1: Over-Engineering Inline Editing
**What goes wrong:** Building complex contenteditable handling with undo stacks, selection management, paste sanitization
**Why it happens:** Trying to replicate spreadsheet functionality
**How to avoid:** For simple fields (description, quantity, cost), basic contenteditable with input events is sufficient. For complex cells, fall back to input replacement.
**Warning signs:** Building more than 50 lines of code for inline editing

### Pitfall 2: Breaking Mobile with Horizontal Tables
**What goes wrong:** Data tables become unusable on phones - tiny cells, horizontal scroll hell
**Why it happens:** Desktop-first design
**How to avoid:**
- Mobile: Transform to card/list view with key fields only (Description, Amount)
- Tablet: Horizontal scroll with sticky first column
- Desktop: Full table
**Warning signs:** More than 5 columns visible on mobile

### Pitfall 3: Removing Features Users Depend On
**What goes wrong:** Removing a "clutter" button that power users rely on
**Why it happens:** No usage analytics, assumptions about what's needed
**How to avoid:**
- Check which functions are actually implemented (many are "coming soon")
- Keep working features, just hide behind progressive disclosure
- Add keyboard shortcuts for power users
**Warning signs:** Fully deleting onclick handlers without checking if function is implemented

### Pitfall 4: Workflow Stepper with Variable Steps
**What goes wrong:** Steps change based on user choices, causing disorientation
**Why it happens:** Business logic complexity
**How to avoid:** Keep the 4 steps fixed (Create -> Build -> Review -> Send). Optional sub-steps can appear within each step but don't change the main stepper.
**Warning signs:** Adding "Step 2a" or conditional step visibility

## Code Examples

### Inline Editable Table Cell
```javascript
// Source: Sling Academy, CSS-Tricks contenteditable patterns
class InlineEditableCell {
  constructor(element, options = {}) {
    this.el = element;
    this.field = element.dataset.field;
    this.rowId = element.closest('tr').dataset.id;
    this.type = options.type || 'text'; // text, number, currency
    this.onSave = options.onSave || (() => {});

    this.originalValue = null;
    this.init();
  }

  init() {
    this.el.classList.add('editable-cell');
    this.el.addEventListener('click', () => this.startEdit());
    this.el.addEventListener('dblclick', () => this.startEdit());
  }

  startEdit() {
    if (this.el.contentEditable === 'true') return;

    this.originalValue = this.el.textContent;
    this.el.contentEditable = true;
    this.el.classList.add('editing');
    this.el.focus();

    // Select all
    document.execCommand('selectAll', false, null);

    this.el.addEventListener('keydown', this.handleKeydown.bind(this));
    this.el.addEventListener('blur', this.handleBlur.bind(this), { once: true });
  }

  handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.save();
    } else if (e.key === 'Escape') {
      this.cancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.save();
      this.moveToNext(e.shiftKey);
    }
  }

  handleBlur() {
    // Small delay to allow button clicks
    setTimeout(() => this.save(), 100);
  }

  save() {
    this.el.contentEditable = false;
    this.el.classList.remove('editing');

    let value = this.el.textContent.trim();

    // Parse based on type
    if (this.type === 'number' || this.type === 'currency') {
      value = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
      this.el.textContent = this.type === 'currency'
        ? formatCurrency(value)
        : value;
    }

    if (value !== this.originalValue) {
      this.onSave(this.rowId, this.field, value);
    }
  }

  cancel() {
    this.el.textContent = this.originalValue;
    this.el.contentEditable = false;
    this.el.classList.remove('editing');
  }

  moveToNext(reverse = false) {
    const cells = [...document.querySelectorAll('.editable-cell')];
    const currentIndex = cells.indexOf(this.el);
    const nextIndex = reverse ? currentIndex - 1 : currentIndex + 1;
    if (cells[nextIndex]) {
      cells[nextIndex].click();
    }
  }
}
```

### CSS for Inline Editing
```css
/* Source: Atlassian Design System inline-edit patterns */
.editable-cell {
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 0.15s;
  min-height: 32px;
}

.editable-cell:hover:not(.editing) {
  background-color: var(--accent);
}

.editable-cell.editing {
  background-color: var(--card);
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

/* Visual indicator of editability */
.editable-cell::after {
  content: '';
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.15s;
}

.editable-cell:hover::after {
  opacity: 0.5;
  content: url("data:image/svg+xml,..."); /* pencil icon */
}
```

### Workflow Stepper CSS
```css
/* Source: USWDS Step Indicator, PatternFly Progress Stepper */
.workflow-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 16px 24px;
  background: var(--card);
  border-radius: 8px;
  margin-bottom: 24px;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  background: var(--muted);
  color: var(--muted-foreground);
  transition: all 0.2s;
}

.step.current .step-number {
  background: var(--primary);
  color: var(--primary-foreground);
}

.step.completed .step-number {
  background: var(--success);
  color: white;
}

.step.completed .step-number::after {
  content: '\2713'; /* checkmark */
}

.step-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--muted-foreground);
}

.step.current .step-label,
.step.completed .step-label {
  color: var(--foreground);
}

.step-connector {
  flex: 1;
  height: 2px;
  background: var(--border);
  margin: 0 12px;
  min-width: 40px;
}

.step-connector.completed {
  background: var(--success);
}

/* Mobile: Stack vertically */
@media (max-width: 640px) {
  .workflow-stepper {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .step-connector {
    width: 2px;
    height: 16px;
    margin: 0 0 0 13px;
  }
}
```

### Mobile-Responsive Table Pattern
```css
/* Source: Nielsen Norman Group, Medium design-bootcamp patterns */

/* Desktop: Full table */
@media (min-width: 1024px) {
  .estimate-lines-table {
    display: table;
  }
}

/* Tablet: Horizontal scroll with sticky */
@media (min-width: 641px) and (max-width: 1023px) {
  .estimate-lines-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .estimate-lines-table th:first-child,
  .estimate-lines-table td:first-child {
    position: sticky;
    left: 0;
    background: var(--card);
    z-index: 1;
  }
}

/* Mobile: Card view */
@media (max-width: 640px) {
  .estimate-lines-table {
    display: none;
  }

  .estimate-lines-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .line-item-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }

  .line-item-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .line-item-card-description {
    font-weight: 500;
    flex: 1;
  }

  .line-item-card-amount {
    font-weight: 600;
    font-family: monospace;
  }

  .line-item-card-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }
}
```

## Audit: Buttons/Features to Remove or Consolidate

### Header Actions (Currently 2 buttons)
| Current | Recommendation | Reason |
|---------|---------------|--------|
| "From Selections" button | Move to overflow menu | Niche use case |
| "+ New Estimate" button | Keep as primary action | Core workflow |

### Estimates Toolbar (Currently 6 items)
| Current | Recommendation | Reason |
|---------|---------------|--------|
| Job filter dropdown | Keep | Essential filter |
| Status filter dropdown | Keep | Essential filter |
| Search input | Keep | Essential |
| View toggle (table/cards) | Remove | Pick one view, table is standard |
| Column settings button | Remove | Rarely used, add complexity |
| "Import from Bid" button | Move to "+ New" dropdown | Niche use case |

### Detail Modal Actions (Currently 12+ buttons)
| Current | Recommendation | Reason |
|---------|---------------|--------|
| Overview tab | Merge into main view | Reduce tab count |
| Line Items tab | Make default view | Primary use |
| Versions tab | Move to overflow menu | Power user feature |
| Activity tab | Remove or move to footer | Low priority |
| "Edit Markup" button | Keep, make more prominent | Important |
| "Generate Scope" button | Move to overflow | Niche |
| "View All" scopes | Remove | Not implemented |
| "Convert to Budget" button | Keep | Workflow step |
| "To Allowances" button | Remove | Not implemented, confusing |
| "Duplicate" button | Move to overflow | Power user |
| "Edit Estimate" button | Remove - use inline editing | Modal not needed |
| "+ New Version" button | Remove | Not implemented |

### Line Items Toolbar (Currently 7+ buttons)
| Current | Recommendation | Reason |
|---------|---------------|--------|
| Group dropdown | Remove | Not implemented |
| Library toggle | Move to sidebar auto-show | Reduce buttons |
| Columns button | Remove | Keep columns fixed |
| Group button | Remove | Hidden anyway, not implemented |
| Templates button | Move to "+" dropdown | Niche |
| AI Scope button | Move to "+" dropdown | Niche |
| Add Item button | Keep as primary | Core action |

### Budget Mode Actions (Currently 5 buttons)
| Current | Recommendation | Reason |
|---------|---------------|--------|
| "Refresh Pricing Data" | Remove | Confusing, should be automatic |
| "Generate AI Estimate" | Keep but relocate | Important feature |
| "Auto-Assemble Budget" | Keep | Core action |
| "Lock All" | Move to table header | Context-specific |
| "Unlock All" | Move to table header | Context-specific |
| "Export" | Keep | Standard feature |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Modal for all edits | Inline editing with click-to-edit | 2023+ | Major UX improvement, faster data entry |
| Desktop-first tables | Mobile-first with card fallback | 2024+ | Field workers can use tablets |
| All features visible | Progressive disclosure | 2024+ | Cleaner interface, less overwhelm |
| Multiple modes (Estimates/Budget) | Single unified flow with steps | Recommended | Reduces confusion |

**Deprecated/outdated:**
- View toggle (table/cards): Pick one view and optimize it
- Column customization for simple tables: Overhead not worth it
- Dual mode switcher: Consider separate URLs or clearer workflow

## Open Questions

Things that couldn't be fully resolved:

1. **Estimates vs Budget Mode**
   - What we know: Both modes exist, share same page, confuse users
   - What's unclear: Should they be separate pages? Same page with better separation? Unified workflow?
   - Recommendation: Start with cleaner separation, potentially split to separate pages in future

2. **Feature Implementation Status**
   - What we know: Many buttons show "coming soon" toasts
   - What's unclear: Which features are priorities? Which can be removed entirely?
   - Recommendation: Audit each function, remove placeholders, implement or remove

3. **Keyboard Shortcut Scheme**
   - What we know: Power users want shortcuts
   - What's unclear: What shortcuts do construction estimators actually use?
   - Recommendation: Start with spreadsheet conventions (Tab, Enter, Escape, Ctrl+S), gather feedback

## Sources

### Primary (HIGH confidence)
- Current codebase audit (`estimates-budget.html`, `estimates-budget.js`)
- [PatternFly Inline Edit Design Guidelines](https://www.patternfly.org/components/inline-edit/design-guidelines/) - Inline editing patterns
- [USWDS Step Indicator](https://designsystem.digital.gov/components/step-indicator/) - Workflow stepper patterns
- [Atlassian Design System - Inline Edit](https://atlassian.design/components/inline-edit/) - Inline editing component

### Secondary (MEDIUM confidence)
- [Buildertrend vs Buildxact Comparison](https://www.capterra.com/compare/70092-173135/Buildertrend-vs-buildXACT) - Competitor analysis
- [Buildxact vs CoConstruct](https://www.buildxact.com/us/buildxact-vs-coconstruct/) - UX comparison
- [CSS-Tricks: Saving contenteditable](https://css-tricks.com/snippets/javascript/saving-contenteditable-content-changes-as-json-with-ajax/) - Implementation patterns
- [Sling Academy: Inline Editing](https://www.slingacademy.com/article/editing-text-content-inline-with-javascript-dom/) - Technical implementation
- [Nielsen Norman Group: Mobile Tables](https://www.nngroup.com/articles/mobile-tables/) - Responsive patterns

### Tertiary (LOW confidence - WebSearch only)
- [UX Design World: Inline Editing in Tables](https://uxdworld.com/inline-editing-in-tables-design/) - Best practices
- [Medium: Data Table Design](https://medium.com/design-bootcamp/designing-user-friendly-data-tables-for-mobile-devices-c470c82403ad) - Mobile patterns
- Competitor UX claims from review sites (may be marketing)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing technologies, no new dependencies
- Architecture: MEDIUM - Recommendations based on patterns, requires validation
- Pitfalls: MEDIUM - Based on common issues, may have project-specific concerns
- Button audit: HIGH - Based on actual code analysis
- Code examples: MEDIUM - Adapted from multiple sources, needs testing

**Research date:** 2026-01-22
**Valid until:** 60 days (stable UX patterns, no rapid changes expected)
