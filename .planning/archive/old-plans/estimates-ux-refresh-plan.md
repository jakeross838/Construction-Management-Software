# Estimates UX Refresh Plan

## Executive Summary
Transform the estimates module from a functional tool into a polished, professional estimating experience that rivals industry leaders (Buildern, BuildBook, PlanSwift).

---

## Current Pain Points
1. **Dense interface** - Too much information competing for attention
2. **Hidden features** - Users don't discover inline editing, drag-drop, sidebar
3. **No visual hierarchy** - Everything looks equally important
4. **Weak empty states** - No guidance when starting fresh
5. **Modal fatigue** - Too many popups interrupt flow
6. **No keyboard shortcuts** - Power users slowed down
7. **Limited feedback** - Users unsure if actions succeeded

---

## Phase 1: Visual Foundation (High Impact)

### 1.1 Card-Based Estimate List
Replace flat list with rich cards showing:
```
┌─────────────────────────────────────────────────────────┐
│ 🏠 Drummond Residence - Initial Estimate          v2   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                         │
│  $247,500        18 items       Draft                  │
│  Total           Line Items     ●━━━━━○ Status         │
│                                                         │
│  Updated 2 hours ago by Jake Ross                      │
│                                        [Open] [⋮]      │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Improved Status Badges
- Larger, pill-shaped badges with icons
- Color-coded backgrounds (not just text)
- Progress indicator for workflow position

### 1.3 Typography Hierarchy
- Estimate title: 18px semibold
- Amounts: Tabular numbers, monospace, green for totals
- Labels: 12px uppercase, muted color
- Better line-height and spacing

### 1.4 Micro-interactions
- Subtle hover effects on cards and rows
- Smooth transitions (150-200ms)
- Success checkmarks that animate
- Skeleton loaders while fetching

---

## Phase 2: Estimate Detail Redesign

### 2.1 Split-Panel Layout (Instead of Tabs)
```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back    Drummond Residence - Initial Estimate    [Actions ▾]  │
├────────────────────┬─────────────────────────────────────────────┤
│                    │                                             │
│  SUMMARY           │  LINE ITEMS                                 │
│  ─────────         │  ───────────────────────────────────────    │
│  Job: Drummond     │  [+ Add] [Templates] [AI] [Library]         │
│  Status: Draft     │  ┌─────────────────────────────────────┐    │
│  Created: Jan 15   │  │ ⋮⋮ □ 1  Framing Labor    $45,000   │    │
│                    │  │ ⋮⋮ □ 2  Framing Material $12,500   │    │
│  ───────────       │  │ ⋮⋮ □ 3  Roofing Package  $28,000   │    │
│  TOTALS            │  │    └ 3.1 Shingles        $18,000   │    │
│  ─────────         │  │    └ 3.2 Labor           $10,000   │    │
│  Subtotal $247,500 │  └─────────────────────────────────────┘    │
│  Markup 15% $37,125│                                             │
│  ━━━━━━━━━━━━━━━━━ │  Total: $247,500                           │
│  TOTAL   $284,625  │                                             │
│                    ├─────────────────────────────────────────────┤
│  [Submit for       │  COST LIBRARY (collapsible)                 │
│   Approval]        │  [Search cost codes...]                     │
│                    │  ▼ Planning (12)                            │
│  ───────────       │    01101 Architectural Services             │
│  VERSIONS          │    01102 Design Services                    │
│  v2 (current)      │  ▶ Site Work (8)                            │
│  v1 Jan 10         │  ▶ Concrete (15)                            │
│                    │                                             │
└────────────────────┴─────────────────────────────────────────────┘
```

### 2.2 Floating Action Bar
When items are selected, show floating bar at bottom:
```
┌─────────────────────────────────────────────────────────────────┐
│  3 items selected    [Create Assembly] [Duplicate] [Delete]  ✕  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Quick-Add Row
Always show an empty row at bottom for rapid entry:
```
│ + │   │ Type cost code or description...  │     │    │        │
```
- Auto-complete as user types
- Tab through fields
- Enter to save and create new row

### 2.4 Inline Expansion for Assemblies
Click assembly row to expand/collapse inline (no modal):
```
│ ▼ │ 3 │ Roofing Package              │     │ LS │ $28,000  │ ⋮ │
│   │3.1│   ├ Shingles                 │ 45  │ SQ │ $18,000  │   │
│   │3.2│   └ Labor                    │ 1   │ LS │ $10,000  │   │
```

---

## Phase 3: Efficiency Features

### 3.1 Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `N` | New line item |
| `A` | Open AI scope analysis |
| `T` | Open templates |
| `L` | Toggle cost library |
| `⌘/Ctrl + S` | Save estimate |
| `⌘/Ctrl + D` | Duplicate selected |
| `Delete` | Delete selected |
| `⌘/Ctrl + G` | Group into assembly |
| `Esc` | Deselect all |
| `↑/↓` | Navigate rows |
| `Enter` | Edit selected row |

### 3.2 Command Palette (⌘K)
Quick access to any action:
```
┌─────────────────────────────────────────┐
│ 🔍 Type a command...                    │
├─────────────────────────────────────────┤
│ → Add line item                         │
│ → Create assembly from selection        │
│ → Submit for approval                   │
│ → Duplicate estimate                    │
│ → Export to PDF                         │
│ → Open templates                        │
└─────────────────────────────────────────┘
```

### 3.3 Smart Defaults
- Remember last used unit per cost code
- Suggest quantities based on job square footage
- Auto-calculate amounts as you type
- Carry forward markup % from previous estimates

### 3.4 Bulk Operations
- Multi-select with Shift+Click
- Bulk change cost code
- Bulk adjust markup %
- Bulk move to assembly

---

## Phase 4: Empty States & Onboarding

### 4.1 Empty Estimate List
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    📋                                       │
│                                                             │
│            No estimates yet                                 │
│                                                             │
│   Create your first estimate to start tracking             │
│   project costs and generating proposals.                  │
│                                                             │
│          [+ Create First Estimate]                         │
│                                                             │
│   ─────────────────────────────────────────                │
│                                                             │
│   💡 Quick tips:                                           │
│   • Use templates for common project types                 │
│   • Import from accepted bids automatically                │
│   • AI can generate line items from scope text             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Empty Line Items
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Start building your estimate                              │
│                                                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │ + Manual │  │ 📋 From  │  │ 🤖 AI    │  │ 📚 Cost  │   │
│   │   Entry  │  │ Template │  │  Scope   │  │  Library │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Feature Discovery Tooltips
First-time hints that appear once:
- "💡 Click any cell to edit inline"
- "💡 Drag the ⋮⋮ handle to reorder"
- "💡 Select items and press G to group"

---

## Phase 5: Data Visualization

### 5.1 Estimate Summary Cards
```
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ $247,500   │ │ 18         │ │ 3          │ │ 85%        │
│ Total      │ │ Line Items │ │ Assemblies │ │ Coded      │
│ ↑12% vs v1 │ │            │ │            │ │ 3 uncoded  │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

### 5.2 Cost Breakdown Chart
Mini donut chart showing category distribution:
```
     Planning 8%
        ┌───┐
    ┌───┤   ├───┐
    │   │ ● │   │  Framing 35%
    │   └───┘   │
    └───────────┘
   MEP 22%    Finishes 35%
```

### 5.3 Version Comparison
Side-by-side diff when viewing versions:
```
v1 → v2 Changes:
  + Added: Permit Fees ($2,500)
  ~ Changed: Framing Labor $42,000 → $45,000
  - Removed: Temporary Fencing

  Net change: +$5,500 (+2.2%)
```

---

## Phase 6: Mobile Optimization

### 6.1 Responsive Breakpoints
- **Desktop (>1200px)**: Full split-panel layout
- **Tablet (768-1200px)**: Collapsible sidebar, stacked layout
- **Mobile (<768px)**: Single column, bottom sheet for actions

### 6.2 Touch-Friendly Targets
- Minimum 44px tap targets
- Swipe to reveal actions on rows
- Pull-to-refresh estimate list
- Bottom navigation on mobile

### 6.3 Mobile Line Item Entry
Slide-up panel optimized for thumb reach:
```
┌─────────────────────────────────────────┐
│ Add Line Item                        ✕  │
├─────────────────────────────────────────┤
│                                         │
│ Cost Code    [Search or select ▾]       │
│                                         │
│ Description  [                    ]     │
│                                         │
│ Qty [    ]  Unit [LS ▾]  Rate [$     ]  │
│                                         │
│ Amount: $0.00                           │
│                                         │
│         [Cancel]  [Add Line Item]       │
│                                         │
└─────────────────────────────────────────┘
```

---

## Phase 7: Advanced Features

### 7.1 Estimate Comparison
Compare multiple estimates side-by-side:
- Same job, different versions
- Same job, different contractors (from bids)
- Template vs. actual

### 7.2 Markup & Margin Calculator
Built-in tools for:
- Apply markup % to cost
- Calculate margin from sell price
- Category-specific markup rules
- Overhead & profit breakdown

### 7.3 Export Options
- **PDF Proposal**: Client-facing, branded
- **Excel Workbook**: Detailed breakdown
- **CSV**: For import into accounting
- **Shareable Link**: View-only estimate

### 7.4 Collaboration
- Comments on line items
- @mentions for team members
- Change request workflow
- Approval signatures

---

## Implementation Priority

### Sprint 1 (High Impact, Low Effort)
1. Card-based estimate list
2. Improved status badges & typography
3. Empty states with guidance
4. Keyboard shortcuts (basic set)
5. Quick-add row for line items

### Sprint 2 (Core UX)
1. Split-panel layout
2. Floating action bar for selections
3. Inline assembly expansion
4. Feature discovery tooltips
5. Summary cards & mini charts

### Sprint 3 (Power Features)
1. Command palette (⌘K)
2. Version comparison view
3. Markup calculator
4. Enhanced export options
5. Mobile optimization

### Sprint 4 (Polish)
1. Micro-interactions & animations
2. Responsive refinements
3. Collaboration features
4. Advanced comparison tools
5. Performance optimization

---

## Design Tokens to Update

```css
/* Spacing */
--space-section: 2rem;
--space-card: 1.25rem;
--space-row: 0.75rem;

/* Typography */
--font-size-title: 1.25rem;
--font-size-amount: 1.125rem;
--font-size-label: 0.75rem;
--font-weight-semibold: 600;

/* Colors - Estimate specific */
--estimate-draft: #f59e0b;
--estimate-submitted: #3b82f6;
--estimate-approved: #22c55e;
--estimate-converted: #8b5cf6;

/* Shadows */
--shadow-card: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
--shadow-card-hover: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);

/* Transitions */
--transition-card: transform 0.15s ease, box-shadow 0.15s ease;
```

---

## Success Metrics
- **Task completion time**: Create estimate with 10 items < 5 minutes
- **Discoverability**: 80% of users find inline editing within first session
- **Error rate**: < 2% of line item entries require correction
- **Mobile usage**: Support 100% of core features on tablet

---

## Next Steps
1. Review and prioritize with stakeholder
2. Create Figma mockups for key screens
3. Implement Sprint 1 items
4. User testing with 3-5 contractors
5. Iterate based on feedback
