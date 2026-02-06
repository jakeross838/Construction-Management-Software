# Ross Built CMS - UI & Styling Guide

## Overview

This document defines the design system for the Ross Built Construction Management Software. The system uses a warm, professional aesthetic inspired by modern SaaS applications like Buildertrend, CoConstruct, Airtable, and Notion.

## Technology Stack

- **CSS Framework**: Tailwind CSS v3.x
- **Component Library**: shadcn/ui (Radix primitives)
- **Fonts**: Inter (sans), JetBrains Mono (code)
- **Icons**: Lucide React

---

## Color Palette

### Core Colors

| Token | HSL Value | Hex | Usage |
|-------|-----------|-----|-------|
| `--background` | `36 20% 96%` | `#f5f3ef` | Page background (warm cream) |
| `--foreground` | `30 12% 16%` | `#2d2a26` | Primary text (warm brown) |
| `--card` | `40 25% 98%` | `#faf9f6` | Card backgrounds |
| `--primary` | `220 62% 53%` | `#3b6fd4` | Primary actions, links |
| `--secondary` | `35 15% 93%` | - | Secondary elements |
| `--muted` | `36 15% 94%` | - | Disabled, subtle elements |
| `--accent` | `220 30% 95%` | - | Hover states, highlights |

### Status Colors

| Token | HSL Value | Hex | Usage |
|-------|-----------|-----|-------|
| `--success` | `142 71% 36%` | `#16a34a` | Success, approved, positive |
| `--warning` | `32 95% 44%` | `#d97706` | Warnings, pending, attention |
| `--destructive` | `0 72% 51%` | `#dc2626` | Errors, destructive actions |
| `--info` | `221 83% 53%` | `#2563eb` | Information, links |
| `--purple` | `263 70% 58%` | `#7c3aed` | In progress, special states |

### Financial Colors

| Token | Usage |
|-------|-------|
| `--profit` | Positive financial values (green) |
| `--loss` | Negative financial values (red) |
| `--neutral` | Neutral financial values (gray) |

### Chart Colors

Sequential palette for data visualization:
- `--chart-1`: Primary blue
- `--chart-2`: Success green
- `--chart-3`: Warning amber
- `--chart-4`: Purple
- `--chart-5`: Destructive red

---

## Typography

### Font Families

```css
font-family: 'Inter', system-ui, sans-serif;  /* Primary */
font-family: 'JetBrains Mono', monospace;     /* Code/numbers */
```

### Font Weights

| Weight | Usage |
|--------|-------|
| 400 (normal) | Body text |
| 500 (medium) | Subtle emphasis |
| 600 (semibold) | Headings, labels |
| 700 (bold) | Strong emphasis |

### Text Sizes

| Class | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Labels, captions, badges |
| `text-sm` | 14px | Body text, table content |
| `text-base` | 16px | Default, larger body |
| `text-lg` | 18px | Subheadings |
| `text-xl` | 20px | Section headers |
| `text-2xl` | 24px | Page titles |

### Text Colors

| Class | Usage |
|-------|-------|
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary text, labels |
| `text-primary` | Links, interactive |

---

## Spacing

Use Tailwind's spacing scale consistently:

| Token | Size | Usage |
|-------|------|-------|
| `1` | 4px | Tight spacing |
| `2` | 8px | Icon margins |
| `3` | 12px | Small gaps |
| `4` | 16px | Standard padding |
| `5` | 20px | Card padding |
| `6` | 24px | Section spacing |
| `8` | 32px | Large sections |

### Standard Patterns

```jsx
// Card padding
<Card className="p-5">

// Form field spacing
<div className="space-y-4">

// Button icon spacing
<Button><Icon className="mr-2" />Label</Button>

// Table cell padding
<td className="px-4 py-3">
```

---

## Border Radius

| Token | Size | Usage |
|-------|------|-------|
| `rounded-sm` | 4px | Small elements |
| `rounded-md` | 6px | Inputs, buttons |
| `rounded-lg` | 8px | Cards, dialogs |
| `rounded-full` | 100% | Badges, avatars |

---

## Components

### Buttons

```jsx
// Primary action
<Button>Create Invoice</Button>

// Secondary action
<Button variant="outline">Cancel</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// Ghost/subtle action
<Button variant="ghost">View Details</Button>

// With icon
<Button><Plus className="h-4 w-4 mr-2" />Add Item</Button>
```

### Cards

```jsx
<Card className="stat-card">
  <div className="flex items-center gap-3">
    <div className="p-2 rounded-lg bg-primary/10">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">Label</p>
      <p className="text-2xl font-semibold">$125,000</p>
    </div>
  </div>
</Card>
```

### Status Badges

```jsx
// Success
<Badge className="status-badge-success">Approved</Badge>

// Warning
<Badge className="status-badge-warning">Pending</Badge>

// Danger
<Badge className="status-badge-danger">Overdue</Badge>

// Info
<Badge className="status-badge-info">New</Badge>

// Purple (in progress)
<Badge className="status-badge-purple">In Progress</Badge>

// Neutral
<Badge className="status-badge-neutral">Draft</Badge>
```

### Tables

```jsx
<table className="data-table">
  <thead>
    <tr>
      <th>Invoice #</th>
      <th>Client</th>
      <th className="text-right">Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>INV-001</td>
      <td>Client Name</td>
      <td className="text-right font-mono">$12,500.00</td>
    </tr>
  </tbody>
</table>
```

### Empty States

```jsx
<div className="empty-state">
  <div className="empty-state-icon">
    <FileText className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="empty-state-title">No invoices yet</h3>
  <p className="empty-state-description">
    Create your first invoice to get started
  </p>
  <Button>Create Invoice</Button>
</div>
```

### Loading States

```jsx
// Skeleton loading
<div className="shimmer h-4 w-32 bg-muted rounded" />

// Spinner
<Loader2 className="h-4 w-4 animate-spin" />
```

---

## Navigation

### Sidebar Items

```jsx
<a className="nav-item active">
  <Home className="h-5 w-5" />
  <span>Dashboard</span>
</a>

<a className="nav-item">
  <FileText className="h-5 w-5" />
  <span>Invoices</span>
</a>
```

### Section Headers

```jsx
<h3 className="section-header">Financial</h3>
```

---

## Forms

### Input Fields

```jsx
<div className="space-y-2">
  <Label htmlFor="name">Project Name</Label>
  <Input id="name" placeholder="Enter project name" />
</div>
```

### Select Fields

```jsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="active">Active</SelectItem>
    <SelectItem value="completed">Completed</SelectItem>
  </SelectContent>
</Select>
```

### Form Layout

```jsx
// Two-column form
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label>First Name</Label>
    <Input />
  </div>
  <div className="space-y-2">
    <Label>Last Name</Label>
    <Input />
  </div>
</div>
```

---

## Financial Formatting

### Currency Display

```jsx
// Positive amounts
<span className="font-mono text-profit">$12,500.00</span>

// Negative amounts (losses)
<span className="font-mono text-loss">-$1,250.00</span>

// Neutral amounts
<span className="font-mono">$0.00</span>
```

### Percentage Display

```jsx
// Profit margin
<span className="text-profit">+15.5%</span>

// Loss margin
<span className="text-loss">-3.2%</span>
```

---

## Animations

### Available Animations

| Class | Duration | Usage |
|-------|----------|-------|
| `animate-fade-in` | 0.3s | Content appearing |
| `animate-slide-up` | 0.4s | Modals, sheets |
| `animate-scale-in` | 0.2s | Popovers, dropdowns |

### Usage

```jsx
<div className="animate-fade-in">
  Content fades in
</div>

<Sheet className="animate-slide-up">
  Sheet slides up
</Sheet>
```

---

## Responsive Design

### Breakpoints

| Prefix | Min Width | Usage |
|--------|-----------|-------|
| `sm` | 640px | Tablet portrait |
| `md` | 768px | Tablet landscape |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1400px | Extra large |

### Common Patterns

```jsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

// Hide on mobile
<div className="hidden md:block">

// Stack on mobile, row on desktop
<div className="flex flex-col md:flex-row gap-4">
```

---

## UI Component Library

Located in `client/src/components/ui/`:

### Core Components
- `button.tsx` - Buttons and variants
- `input.tsx` - Text inputs
- `select.tsx` - Dropdown selects
- `checkbox.tsx` - Checkboxes
- `switch.tsx` - Toggle switches
- `textarea.tsx` - Multiline inputs

### Layout Components
- `card.tsx` - Content cards
- `dialog.tsx` - Modal dialogs
- `sheet.tsx` - Slide-over panels
- `tabs.tsx` - Tab navigation
- `table.tsx` - Data tables

### Feedback Components
- `toast.tsx` - Toast notifications
- `alert.tsx` - Alert messages
- `badge.tsx` - Status badges
- `progress.tsx` - Progress bars
- `skeleton.tsx` - Loading skeletons

### Navigation Components
- `dropdown-menu.tsx` - Dropdown menus
- `command.tsx` - Command palette
- `breadcrumb.tsx` - Breadcrumb nav
- `sidebar.tsx` - App sidebar

---

## Best Practices

### Do's
- Use semantic color tokens (success, warning) over raw colors
- Use `font-mono` for financial numbers
- Use consistent spacing (4, 8, 16, 24 scale)
- Use empty states for no-data scenarios
- Use loading skeletons over spinners when possible

### Don'ts
- Don't use arbitrary color values
- Don't override component styles inline
- Don't use fixed pixel values for responsive layouts
- Don't skip loading states
- Don't use raw CSS when Tailwind classes exist

---

## File Locations

| File | Purpose |
|------|---------|
| `client/src/index.css` | Global styles, CSS variables |
| `client/tailwind.config.ts` | Tailwind configuration |
| `client/src/components/ui/` | shadcn/ui components |
| `client/src/lib/utils.ts` | `cn()` class merger utility |
