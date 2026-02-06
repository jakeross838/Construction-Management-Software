# Ross Built CMS - Knowledge Base

> **PASTE THIS INTO LOVABLE'S KNOWLEDGE FEATURE**
> This context is sent with every prompt to maintain consistency.

---

## Project Overview

**App Name:** Ross Built Construction Management Software
**Industry:** Custom residential home construction (Sarasota, Florida)
**Purpose:** Business operating system for custom home builders - manages leads, estimates, construction operations, and financials.

**Primary Users:** Owner, Project Managers, Accounting staff, Field supervisors
**Secondary Users:** Clients (limited portal access)

---

## Tech Stack

**Frontend:** React + TypeScript + Vite
**Styling:** Tailwind CSS + shadcn/ui components
**Backend API:** REST API at `http://localhost:3001/api` (already exists)
**Database:** Supabase (PostgreSQL)
**Authentication:** Handled by backend (assume user is logged in)

---

## Design System

### Theme
- **Style:** Warm light theme (NOT stark white)
- **Feel:** Professional, clean, information-dense but not cluttered
- **Inspiration:** Buildertrend, CoConstruct, Airtable

### Color Palette
```css
/* Backgrounds */
--background: #f5f3ef;        /* Warm cream - page background */
--card: #faf9f6;              /* Soft cream - card backgrounds */
--foreground: #2d2a26;        /* Warm dark brown - primary text */
--muted: #6b6560;             /* Muted brown - secondary text */
--border: #ddd9d2;            /* Warm gray - borders */

/* Primary Actions */
--primary: #3b6fd4;           /* Blue - buttons, links */
--primary-hover: #2f5bb8;     /* Darker blue - hover state */

/* Status Colors */
--success: #16a34a;           /* Green - approved, complete */
--warning: #d97706;           /* Amber - pending, needs attention */
--info: #2563eb;              /* Blue - informational */
--danger: #dc2626;            /* Red - errors, denied */
--purple: #7c3aed;            /* Purple - in progress */
```

### Typography
- **Font:** Inter (or system sans-serif fallback)
- **Headings:** Semi-bold, warm dark brown
- **Body:** Regular weight, good line height for readability

### Status Badges
Use colored pill/badge components:
| Status | Color | Background |
|--------|-------|------------|
| Received/Draft | Gray | `bg-gray-100 text-gray-700` |
| Pending/Needs Approval | Amber | `bg-amber-100 text-amber-700` |
| Approved/Active | Green | `bg-green-100 text-green-700` |
| In Progress/In Draw | Purple | `bg-purple-100 text-purple-700` |
| Complete/Paid | Blue | `bg-blue-100 text-blue-700` |
| Denied/Overdue | Red | `bg-red-100 text-red-700` |

---

## Navigation Structure

### Main Header Navigation
```
[Logo: Ross Built] | Overview | Sales | Pre-Con | Operations | Financial | Closeout | ⚙️ Settings
```

Each nav item is a dropdown with sub-pages.

### Dropdown Menus
```
Overview:     Dashboard, Job Hub
Sales:        Leads (CRM)
Pre-Con:      Estimates, Bids, Selections, Proposals, Contracts
Operations:   Schedule, Daily Logs, Tasks, Files, RFIs, Submittals, Change Orders
Financial:    Invoices, Purchase Orders, Draws, Budget, Expenses, Reports
Closeout:     Punch Lists, Warranties, Lien Releases, Final Docs
Settings:     Vendors, Employees, Cost Codes, Company
```

### Job Sidebar (on job-specific pages)
Left sidebar with:
- Job selector dropdown
- Selected job info card (name, client, address, contract amount, % complete)
- Persists across page navigation

---

## Role-Based Access (Summary)

| Role | Access Level |
|------|--------------|
| Owner/Admin | Everything |
| Accounting | Financial pages only, all jobs |
| PM | Assigned jobs - full operational + financial |
| Supervisor | Assigned jobs - operational only |
| Field Crew | Mobile: daily logs, photos, timesheets |

**Important:** PM, Supervisor, Field Crew only see their assigned jobs in dropdowns.

---

## API Patterns

**Base URL:** `http://localhost:3001/api`

**Common Endpoints:**
- `GET /api/jobs` - List all jobs
- `GET /api/vendors` - List all vendors
- `GET /api/cost-codes` - List cost codes
- `GET /api/invoices?status=&job_id=` - List invoices with filters
- `GET /api/purchase-orders?job_id=` - List POs
- `GET /api/draws?job_id=` - List draws

**Response Format:**
```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 50, "total": 245 }
}
```

**IDs:** All IDs are UUIDs
**Dates:** ISO 8601 format (`2026-01-23`)
**Currency:** Decimal numbers (format as `$12,345.67` on display)

---

## Component Guidelines

### Use shadcn/ui Components
- Button, Card, Dialog, DropdownMenu, Select, Input, Table, Tabs, Badge, Toast

### Modal Sizes
- **Small:** Confirmations, simple forms (max-w-md)
- **Medium:** Standard forms, detail views (max-w-2xl)
- **Large:** Complex forms, split views (max-w-4xl)
- **Fullscreen:** Multi-tab detail views (max-w-7xl or full)

### Tables
- Sortable columns where appropriate
- Row hover state
- Checkbox for bulk selection on list pages
- Click row to open detail modal

### Empty States
Every list needs an empty state with:
- Relevant icon
- Clear message (e.g., "No invoices yet")
- Primary action button (e.g., "+ Upload Invoice")

### Loading States
- Skeleton loaders for initial page load
- Spinner on buttons during actions
- Toast notifications for async results

---

## Mobile Responsiveness

- All pages must work on tablet (landscape)
- Use responsive breakpoints
- Collapsible sidebar on smaller screens
- Touch-friendly: 44px minimum tap targets
- Stack card layouts vertically on narrow screens

---

## Global Constraints

**ALWAYS:**
- Use the warm cream color palette (not stark white)
- Make responsive on all breakpoints
- Show loading and empty states
- Use shadcn/ui components
- Format currency as $X,XXX.XX
- Format dates as "Jan 23, 2026"

**NEVER:**
- Use dark theme
- Create authentication/login UI
- Hardcode data (always fetch from API)
- Use alert() for notifications (use toast)
