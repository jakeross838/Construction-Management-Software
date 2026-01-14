# Ross Built Construction Management - Style Guide

This document defines the UI/UX standards for the application. All new code must follow these guidelines, and existing code should be updated to match.

---

## 1. Color System

### Primary Colors (CSS Variables)
```css
/* Backgrounds */
--background: #141414;        /* Page background */
--card: #1f1f1f;              /* Card/container background */
--card-elevated: #2a2a2a;     /* Elevated elements (dropdowns, popovers) */

/* Text */
--foreground: #f7f7f7;        /* Primary text */
--text-secondary: #a1a1aa;    /* Secondary/muted text */

/* Borders */
--border: #333333;            /* Standard border */
--border-light: #404040;      /* Lighter border for subtle divisions */

/* Interactive */
--ring: #f7f7f7;              /* Focus ring color */
```

### Status Colors
Use these ONLY for status indicators. Do not use for general UI elements.
```css
--status-received: #666666;           /* Gray - New/Received */
--status-needs-review: #94a3b8;       /* Slate - Needs Review */
--status-ready-for-approval: #f59e0b; /* Orange - Ready for Approval */
--status-approved: #22c55e;           /* Green - Approved */
--status-in-draw: #a855f7;            /* Purple - In Draw */
--status-paid: #3b82f6;               /* Blue - Paid */
--status-denied: #ef4444;             /* Red - Denied */
```

### Semantic Colors
```css
--success: #22c55e;           /* Positive actions, confirmations */
--warning: #f59e0b;           /* Warnings, attention needed */
--danger: #ef4444;            /* Destructive actions, errors */
--info: #3b82f6;              /* Informational */
```

### Usage Rules
- **NEVER** use hardcoded hex values. Always use CSS variables.
- Status colors are for status badges ONLY, not buttons.
- Use `--success` for positive action buttons, `--danger` for destructive.

---

## 2. Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Monospace (for codes, numbers, amounts)
```css
font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
```

### Scale
| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| Page Title | 1.5rem (24px) | 600 | Main page headers |
| Section Header | 1.125rem (18px) | 600 | Section titles in modals |
| Card Title | 1rem (16px) | 600 | Card headers, vendor names |
| Body Text | 0.875rem (14px) | 400 | Default text |
| Small Text | 0.8125rem (13px) | 400 | Labels, secondary info |
| Tiny Text | 0.75rem (12px) | 400 | Badges, meta info |

### Amounts & Codes
- All monetary amounts: `font-family: monospace; font-variant-numeric: tabular-nums;`
- All cost codes: `font-family: monospace;`
- Amounts should be right-aligned in tables/lists

---

## 3. Spacing

### Standard Spacing Scale
```css
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 0.75rem;   /* 12px */
--space-lg: 1rem;      /* 16px */
--space-xl: 1.5rem;    /* 24px */
--space-2xl: 2rem;     /* 32px */
```

### Component Spacing
| Component | Padding | Gap |
|-----------|---------|-----|
| Page | 1.5rem | - |
| Card | 1rem | - |
| Form Section | 1rem | 0.75rem |
| Button | 0.5rem 1rem | - |
| Button (sm) | 0.375rem 0.75rem | - |
| Input | 0.5rem 0.75rem | - |
| Badge | 0.25rem 0.5rem | - |

### Border Radius
```css
--radius-sm: 4px;      /* Inputs, small elements */
--radius-md: 6px;      /* Buttons, badges */
--radius-lg: 8px;      /* Cards, modals */
--radius-xl: 12px;     /* Large containers */
--radius-full: 9999px; /* Pills, circular elements */
```

---

## 4. Buttons

### Primary Variants
Only use these 5 button types. Do not create new variants.

```html
<!-- Primary Action (main CTA) -->
<button class="btn btn-primary">Save</button>

<!-- Secondary Action -->
<button class="btn btn-secondary">Cancel</button>

<!-- Success/Positive Action -->
<button class="btn btn-success">Approve</button>

<!-- Danger/Destructive Action -->
<button class="btn btn-danger">Delete</button>

<!-- Ghost/Subtle Action -->
<button class="btn btn-ghost">More Options</button>
```

### Outline Variants
For less prominent actions:
```html
<button class="btn btn-outline">Secondary</button>
<button class="btn btn-outline-danger">Deny</button>
```

### Sizes
```html
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary">Default</button>
<button class="btn btn-primary btn-lg">Large</button>
```

### Icon Buttons
Fixed 36px × 36px for consistency:
```html
<button class="btn-icon" title="Edit">
  <svg>...</svg>
</button>
```

### Link Buttons
For inline actions that should look like links:
```html
<button class="btn-link">View Details</button>
<button class="btn-link-subtle">+ Split funding</button>
```

### Button Style Reference
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary {
  background: var(--foreground);
  color: var(--background);
  border: none;
}

.btn-secondary {
  background: var(--card-elevated);
  color: var(--foreground);
  border: 1px solid var(--border);
}

.btn-success {
  background: var(--success);
  color: white;
  border: none;
}

.btn-danger {
  background: var(--danger);
  color: white;
  border: none;
}

.btn-ghost {
  background: transparent;
  color: var(--foreground);
  border: none;
}

.btn-outline {
  background: transparent;
  color: var(--foreground);
  border: 1px solid var(--border);
}

.btn-outline-danger {
  background: transparent;
  color: var(--danger);
  border: 1px solid var(--danger);
}
```

---

## 5. Form Inputs

### Standard Input
ALL form inputs use the dark theme. No light theme forms.

```css
.form-input,
.field-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  background: var(--card);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-input:hover,
.field-input:hover {
  border-color: var(--border-light);
}

.form-input:focus,
.field-input:focus {
  outline: none;
  border-color: var(--ring);
  box-shadow: 0 0 0 2px rgba(247, 247, 247, 0.1);
}

.form-input:disabled,
.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Labels
```css
.form-label,
.field-label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-label .required {
  color: var(--danger);
}
```

### Select Elements
Same styling as inputs, with custom dropdown arrow.

### Textareas
Same styling as inputs. Default height: 80px. Resize: vertical.

### Read-Only Fields
```css
.form-input[readonly],
.field-input[readonly] {
  background: var(--card-elevated);
  cursor: default;
}
```

---

## 6. Searchable Dropdowns (Pickers)

### Single Unified Component: SearchablePicker

ALL searchable dropdowns use the same component and styling:
- Job picker
- Vendor picker
- PO picker
- Cost Code picker

```css
/* Container */
.search-picker {
  position: relative;
  width: 100%;
}

/* Input */
.search-picker-input {
  width: 100%;
  padding: 0.5rem 2.5rem 0.5rem 0.75rem;
  font-size: 0.875rem;
  background: var(--card);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

/* Clear button */
.search-picker-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.25rem;
  color: var(--text-secondary);
  cursor: pointer;
}

/* Dropdown */
.search-picker-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  max-height: 300px;
  overflow-y: auto;
  background: var(--card-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow);
  z-index: 1000;
}

/* Dropdown items */
.search-picker-item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 0.1s ease;
}

.search-picker-item:hover,
.search-picker-item.selected {
  background: var(--card);
}

/* Match highlighting */
.search-picker-match {
  background: rgba(247, 247, 247, 0.2);
  border-radius: 2px;
}

/* Empty state */
.search-picker-empty {
  padding: 1rem;
  text-align: center;
  color: var(--text-secondary);
}
```

### Cost Code Display Format
When displaying cost codes, show code and name side-by-side:
```html
<div class="search-picker-item">
  <span class="picker-code">06100</span>
  <span class="picker-name">Rough Carpentry</span>
</div>
```

```css
.picker-code {
  font-family: monospace;
  min-width: 60px;
  color: var(--foreground);
}

.picker-name {
  color: var(--text-secondary);
}
```

---

## 7. Modals

### Standard Modal Structure
```html
<div class="modal-backdrop">
  <div class="modal modal-md">
    <div class="modal-header">
      <h2 class="modal-title">Title</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <!-- Content -->
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </div>
</div>
```

### Modal Sizes
```css
.modal-sm { max-width: 400px; }
.modal-md { max-width: 600px; }
.modal-lg { max-width: 900px; }
.modal-xl { max-width: 1200px; }
.modal-fullscreen { width: 95vw; height: 95vh; }
```

### Modal Backdrop
```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
```

### Modal Animation
```css
.modal {
  transform: scale(0.98) translateY(8px);
  opacity: 0;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.modal.show {
  transform: scale(1) translateY(0);
  opacity: 1;
}
```

### Split View Modal (PDF + Form)
```css
.modal-split-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  height: 100%;
}

@media (max-width: 1024px) {
  .modal-split-view {
    grid-template-columns: 1fr;
  }
}
```

---

## 8. Cards

### Standard Card
```css
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
}

.card-body {
  /* Content */
}
```

### List Item Card (Invoice, PO, etc.)
```css
.list-card {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: var(--card);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border); /* Status color goes here */
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s ease;
}

.list-card:hover {
  background: var(--card-elevated);
}
```

---

## 9. Badges & Status Pills

### Status Pills
For status indicators only:
```css
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

/* Status-specific colors */
.status-pill.received { background: rgba(102, 102, 102, 0.2); color: #999; }
.status-pill.needs-review { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
.status-pill.ready-for-approval { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.status-pill.approved { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
.status-pill.in-draw { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
.status-pill.paid { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
.status-pill.denied { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
```

### Info Badges
For displaying data (PO numbers, cost codes, etc.):
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  border-radius: var(--radius-md);
  background: var(--card-elevated);
  color: var(--text-secondary);
}

.badge-code {
  font-family: monospace;
}
```

### Alert Badges
For warnings/errors:
```css
.badge-warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

.badge-danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.badge-success {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
}
```

---

## 10. Tables

### Standard Table
```css
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.table th {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  background: var(--card);
}

.table td {
  font-size: 0.875rem;
}

.table tbody tr:hover {
  background: var(--card-elevated);
}

/* Right-align amounts */
.table td.amount,
.table th.amount {
  text-align: right;
  font-family: monospace;
}
```

---

## 11. Toasts / Notifications

### Toast Container
```css
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 2000;
}
```

### Toast Styles
```css
.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  min-width: 300px;
  max-width: 400px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow);
  animation: toast-in 0.2s ease;
}

.toast.success { border-left: 3px solid var(--success); }
.toast.error { border-left: 3px solid var(--danger); }
.toast.warning { border-left: 3px solid var(--warning); }
.toast.info { border-left: 3px solid var(--info); }
```

---

## 12. Icons

### Icon Sizing
| Context | Size |
|---------|------|
| Inline with text | 16px (1rem) |
| Button icon | 18px (1.125rem) |
| Card/List icon | 20px (1.25rem) |
| Large decorative | 24px (1.5rem) |

### Icon Style
- Use stroke-based SVG icons (not filled)
- Stroke width: 1.5px to 2px
- Color: `currentColor` (inherits text color)

---

## 13. Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 640px) { }

/* Tablet */
@media (max-width: 1024px) { }

/* Desktop */
@media (min-width: 1025px) { }
```

### Mobile Considerations
- Modals become full-screen below 640px
- Split views stack vertically below 1024px
- Touch targets minimum 44px × 44px

---

## 14. Z-Index Scale

```css
--z-dropdown: 100;
--z-sticky: 200;
--z-modal-backdrop: 1000;
--z-modal: 1001;
--z-toast: 2000;
--z-tooltip: 3000;
```

---

## 15. Animation Standards

### Timing
- Micro-interactions: 0.1s
- Standard transitions: 0.15s
- Modal open/close: 0.2s
- Page transitions: 0.3s

### Easing
- Default: `ease` or `ease-out`
- Bouncy: `cubic-bezier(0.34, 1.56, 0.64, 1)`

### Common Animations
```css
/* Fade in */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide up */
@keyframes slide-up {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Scale in */
@keyframes scale-in {
  from { transform: scale(0.98); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```

---

## Checklist for New Components

Before creating any new UI component, verify:

- [ ] Uses CSS variables for all colors
- [ ] Follows spacing scale
- [ ] Uses standard border-radius values
- [ ] Has appropriate hover/focus states
- [ ] Is keyboard accessible
- [ ] Works on mobile (44px touch targets)
- [ ] Uses monospace font for codes/amounts
- [ ] Follows button/input standards
- [ ] Matches existing patterns in this guide

---

*Last Updated: January 2026*
