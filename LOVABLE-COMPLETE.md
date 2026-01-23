# Ross Built Construction Management Software - Complete Lovable.dev Prompt

> **This document combines all specifications for generating the Ross Built CMS frontend.**
>
> **Contents:**
> 1. Project Overview & Design Requirements
> 2. Role-Based Access System
> 3. Page Wireframes
> 4. API Reference

---

# PART 1: PROJECT OVERVIEW & DESIGN REQUIREMENTS

## Project Overview

Build a modern, professional construction management software frontend for **Ross Built Custom Homes**. This is a comprehensive business operating system for custom home builders that manages everything from leads and estimates through construction and closeout.

**Brand:** Ross Built Custom Homes
**Industry:** Custom residential home construction (Sarasota, Florida)
**Primary Users:** Owner, Project Managers, Accounting staff, Field supervisors
**Secondary Users:** Clients (limited portal access for selections and proposals)

## Design Requirements

### Visual Style
- **Theme:** Warm light theme with cream/off-white backgrounds (NOT stark white)
- **Inspiration:** Buildertrend, CoConstruct, Airtable, Notion
- **Feel:** Professional, clean, data-focused, information-dense but not cluttered
- **Typography:** Inter or similar clean sans-serif font

### Color Palette
```css
/* Core */
--background: #f5f3ef;        /* Warm cream */
--card: #faf9f6;              /* Soft cream cards */
--foreground: #2d2a26;        /* Warm dark brown text */
--border: #ddd9d2;            /* Warm gray borders */

/* Primary */
--primary: #3b6fd4;           /* Warm blue for primary actions */
--primary-hover: #2f5bb8;

/* Status Colors */
--success: #16a34a;           /* Green - approved, complete */
--warning: #d97706;           /* Amber - pending, needs attention */
--info: #2563eb;              /* Blue - informational */
--danger: #dc2626;            /* Red - errors, denied */
--purple: #7c3aed;            /* Purple - in progress */
```

### UI Components Needed
- Stat cards with icons
- Data tables with sorting, filtering
- Modal dialogs (small, medium, large, fullscreen)
- Dropdown menus
- Tab navigation
- Sidebar navigation with collapsible job selector
- Badge/pill status indicators
- Toast notifications
- Empty states with clear CTAs
- Form inputs (text, select, date, currency)
- File upload zones
- Search with filters
- Breadcrumb navigation

---

## Navigation Structure

### Owner/Admin Navigation
```
[Logo: Ross Built] | Overview | Sales | Pre-Con | Operations | Financial | Closeout | Settings
```

### PM/Supervisor Navigation
```
[Logo: Ross Built] | My Jobs | Pre-Con | Operations | Job Finance | Closeout |
```

### Accounting Navigation
```
[Logo: Ross Built] | Overview | Financial | (limited settings)
```

### Field Crew Navigation (Mobile)
```
[Logo] | My Jobs | Daily Logs | Files | Timesheet
```

### Sub-Navigation Per Section

**Overview (Owner/Admin/Accounting):**
- Dashboard (company-wide stats, revenue, margins)
- Job Hub (ALL jobs list)

**My Jobs (PM/Supervisor/Field Crew):**
- Dashboard (my jobs stats, tasks, schedule)
- My Jobs List (only assigned jobs)

**Sales (Owner/Admin only):**
- Leads (CRM pipeline - Kanban board)
- *Note: When a lead is "Won", it converts to a Job and moves to Pre-Con*

**Pre-Con (Pre-Construction):**
- Estimates & Budgets
- Bids (subcontractor bids)
- Selections Catalog
- Proposals
- Contracts (Owner/Admin only)

**Operations (During Construction):**
- Schedule (Gantt chart)
- Daily Logs
- Tasks
- Files (central document repository - photos, plans, permits, specs, etc.)
- RFIs
- Submittals
- Change Orders

**Financial (Owner/Admin/Accounting):**
- Invoices (approval workflow) - ALL jobs
- Purchase Orders - ALL jobs
- Draws (pay applications) - ALL jobs
- Budget Tracking
- Expenses (company overhead)
- P&L Reports
- Cash Flow
- Overhead Allocation
- Profitability

**Job Finance (PM/Supervisor):**
- Invoices (their jobs only - PM can approve any amount)
- Purchase Orders (their jobs only - PM can create/approve)
- Change Orders (their jobs only - PM can create/approve)
- Draws (their jobs only - PM can submit)
- Budget (their jobs only - view/track)

**Closeout:**
- Punch Lists
- Warranties
- Lien Releases
- Final Docs

**Settings (Owner/Admin):**
- Vendors (full management)
- Employees
- Cost Codes
- Company Settings
- Timesheets (all employees)

### Job Sidebar
On job-specific pages, show a left sidebar with:
- **Owner/Admin/Accounting:** Job selector dropdown with ALL jobs + "New Job" button
- **PM/Supervisor/Field Crew:** Job selector with ONLY their assigned jobs (no "New Job")
- Current job info card (name, client, address, status)
- Job team info (PM name, Supervisor name if assigned)
- Quick stats (contract amount, % complete, etc.)

---

## Pages to Build

### 1. Dashboard (Company Overview)
**URL:** `/dashboard`

**Components:**
- 4 stat cards in a row:
  - Invoices Pending Approval (count)
  - Approved This Month ($)
  - Open Purchase Orders (count)
  - Vendors Expiring Soon (count)
- "Needs Attention" section with alert cards
- "Recent Activity" feed

### 2. Job Hub
**URL:** `/job-hub`

**Components:**
- Search/filter bar
- Job cards grid view OR table view toggle
- Each job card shows: name, client, address, status badge, contract amount, % complete progress bar
- Click card to open job profile

### 3. Job Profile
**URL:** `/job-profile?id={jobId}`

**Components:**
- Hero section with job photo, name, client, address
- Tab navigation: Overview | Financial | Schedule | Team | Documents
- **Overview tab:** Key stats, recent activity, milestones timeline
- **Financial tab:** Contract amount, budget summary, invoices list, PO summary
- **Schedule tab:** Mini Gantt or timeline view
- **Team tab:** Assigned crew, contacts
- **Documents tab:** File browser

### 4. Leads (CRM) - Sales Tab
**URL:** `/sales/leads`
**Access:** Owner/Admin only

**Components:**
- Kanban board view with columns: New | Contacted | Qualified | Proposal Sent | Won | Lost
- Card per lead showing: name, source, estimated value, days in stage
- Drag-drop between columns
- Side panel on click: full lead details, activity log, notes
- **"Won" action:** Creates a new Job and moves lead to Pre-Con workflow
- **"Lost" action:** Archives lead with reason (budget, timing, competition, etc.)

### 5. Estimates & Budgets
**URL:** `/estimates-budget`

**Components:**
- Job selector in sidebar
- Two-tier header:
  - **Row 1:** Breadcrumb "JOB: [Name] / ESTIMATE" | Inline cost summary "Builder cost $X + Profit Y% = Total $Z"
  - **Row 2:** Action buttons: + Add Item | + Add Section | Generate Proposal | More dropdown
- Hierarchical table: Phase > Group > Subgroup > Line Items
- Collapsible rows at each level
- Inline editing (click cell to edit)
- Columns: Description | Cost Code | Qty | Unit | Unit Cost | Amount | Allowance
- Footer: Subtotal, Overhead %, Profit %, Contingency %, Grand Total

**Empty State:**
- Large centered card with:
  - Icon (clipboard with dollar sign)
  - "No estimate for this job yet"
  - Primary CTA: "Create New Estimate"
  - Secondary options: "Import from Previous Job" | "Use Template"

### 6. Selections Catalog
**URL:** `/selections` or `/catalog`

**Components:**
- Category sidebar (Appliances, Cabinets, Countertops, Doors, Electrical, Flooring, Hardware, Lighting, Paint, Plumbing, Tile, Windows)
- Product grid with image cards
- Each card: Photo, name, price, vendor, "Select" button
- Filters: price range, brand, quality tier (Builder/Standard/Premium)
- Search bar

### 7. Invoices (Approval Workflow)
**URL:** `/invoices` or `/` (main page)

**Components:**
- Filter toolbar: Status dropdown, Job dropdown, Search
- Invoice list (card or table view)
- Each row: Vendor | Invoice # | Date | Amount | Status badge | Job
- Click opens modal with:
  - Split view: PDF preview (left) | Invoice details (right)
  - Details panel: editable fields, allocations table, action buttons
- Status badges: Received (gray) | Needs Approval (amber) | Approved (green) | In Draw (purple) | Paid (blue) | Denied (red)
- Bulk selection mode for batch approve

### 8. Purchase Orders
**URL:** `/pos`

**Components:**
- Filter toolbar: Status, Job, Vendor
- PO table: PO# | Job | Vendor | Amount | Status | Created
- Click opens fullscreen modal with tabs:
  - **Overview:** Header info, totals, progress bar (invoiced vs PO amount)
  - **Line Items:** Table of line items with cost codes
  - **Invoices:** Linked invoices
  - **Change Orders:** List of COs
  - **Activity:** Audit log
- Create PO button opens modal with line item entry

### 9. Draws (Pay Applications - G702/G703)
**URL:** `/draws`

**Components:**
- Job selector
- Draw list for selected job
- Each draw shows: Draw #, Period, Amount, Status (Draft/Submitted/Funded)
- Click opens fullscreen modal with tabs:
  - **Summary:** Job info, application #, period dates, total amount
  - **G702:** AIA Document G702 format - Application and Certificate for Payment
  - **G703:** Schedule of Values table - cost codes with Budget | Previous | This Period | Total | % Complete | Balance | Retainage columns
  - **Invoices:** List of invoices included in draw, add/remove buttons
- Export buttons: Excel | PDF

### 10. Schedule (Gantt)
**URL:** `/schedule`

**Components:**
- Job selector sidebar
- Gantt chart view showing tasks as horizontal bars
- Task rows: Task name | Duration | Start | End | Assigned crew
- Timeline header with day/week/month zoom
- Dependencies shown as connecting lines
- Today marker line
- Drag to adjust task dates
- Color by phase or crew

### 11. Daily Logs
**URL:** `/daily-logs`

**Components:**
- Job selector
- Date picker
- Daily log form:
  - Weather conditions (icons: sunny, cloudy, rainy)
  - Temperature
  - Work performed (rich text)
  - Crews on site (checkboxes)
  - Deliveries
  - Visitors
  - Safety incidents
  - Photos upload
- Previous logs list view

### 12. Files (Document Repository)
**URL:** `/files`

**Components:**
- Job selector in sidebar
- Category filter tabs: All | Photos | Plans | Contracts | Permits | Specs | Insurance | Correspondence
- File grid/list view toggle
- Each file card shows: Thumbnail/icon, filename, category, uploaded by, date, size
- Upload zone (drag & drop or click)
- Folder structure option (organize by category or custom folders)
- Search files
- Bulk actions: Download, Move, Delete

**File Categories:**
- **Photos**: Progress photos, site conditions, issues, inspections
- **Plans & Drawings**: Blueprints, as-builts, shop drawings, surveys
- **Contracts**: Prime contract, sub agreements, addenda
- **Permits & Inspections**: Building permits, inspection reports, approvals
- **Specs & Cut Sheets**: Material specs, product data, samples
- **Insurance & Compliance**: COIs, licenses, safety docs, OSHA
- **Correspondence**: Emails, letters, meeting notes, RFI responses
- **Selections**: Client selection sheets, allowance tracking

### 13. Timesheets
**URL:** `/timesheets`

**Components:**
- Week selector
- Employee dropdown (for admin) or fixed for current user
- Timesheet grid: Rows = Jobs | Columns = Days (Mon-Sun) | Cells = Hours
- Daily total row
- Weekly total column
- Submit button
- Approval status indicator

### 14. Vendors
**URL:** `/vendors`

**Components:**
- Search and filter bar
- Vendor table: Name | Trade | Phone | Email | Status
- Status: Active (green) | Expiring (amber) | Expired (red) based on insurance/license dates
- Click opens detail panel:
  - Contact info
  - Trade scorecards (quality, reliability, speed ratings)
  - Documents (W9, insurance, license)
  - Recent POs
  - Notes

### 15. Employees
**URL:** `/employees`

**Components:**
- Employee table: Name | Role | Phone | Email | Status
- Click opens detail:
  - Contact info
  - Role/permissions
  - Burden class
  - Current assignments
  - Time history

### 16. Expenses
**URL:** `/expenses`

**Components:**
- Filter: Period, Category, Vendor
- Expense table: Date | Vendor | Category | Amount | Recurring?
- Add expense form: vendor, amount, category, date, receipt upload
- Categories: Fleet, Equipment, Office, Insurance, Software, Professional Services, etc.

### 17. Financial Reports (P&L, Cash Flow)
**URL:** `/pnl`, `/cash-flow`, `/profitability`

**Components:**
- Period selector
- Summary cards: Revenue, COGS, Gross Profit, Overhead, Net Income
- Charts: Revenue trend, expense breakdown pie chart
- Detailed tables with drill-down

### 18. Proposal Generation
**URL:** `/proposal-view?token={shareToken}` (client-facing)

**Components:**
- Clean, minimal client-facing view
- Company branding header (logo, contact)
- Proposal title, job details
- Scope summary or detailed line items
- Total price with allowance call-outs
- Payment schedule/terms
- Accept button with name/email capture
- PDF download button

---

## Data Models (for reference)

### Jobs
```
id, name, address, client_name, contract_amount, status (active/completed/on_hold), created_at
```

### Invoices
```
id, job_id, vendor_id, po_id, invoice_number, invoice_date, due_date, amount, status (received/needs_approval/approved/in_draw/paid/denied), pdf_url
```

### Purchase Orders
```
id, job_id, vendor_id, po_number, description, total_amount, status (open/closed), approval_status (pending/approved)
```

### Estimates
```
id, job_id, name, status (draft/sent/approved/converted), subtotal, overhead_percent, profit_percent, contingency_percent, total
```

### Estimate Line Items
```
id, estimate_id, section_id, cost_code_id, description, quantity, unit, unit_cost, line_total, is_allowance
```

### Draws
```
id, job_id, draw_number, period_end, total_amount, status (draft/submitted/funded)
```

### Vendors
```
id, name, email, phone, trade, status
```

### Cost Codes
```
id, code (e.g., "06100"), name (e.g., "Rough Carpentry"), category
```

### Selections (Catalog Products)
```
id, name, category, brand, price, image_url, quality_tier (builder/standard/premium)
```

---

## Key Workflows to Support

### 1. Invoice Approval Flow
```
Upload PDF -> AI extracts data -> Review -> Approve (stamps PDF) -> Add to Draw -> Mark Paid
```

### 2. Estimate -> Proposal -> Contract
```
Create Estimate -> Add line items -> Set markups -> Generate Proposal -> Client accepts -> Convert to budget
```

### 3. Draw Request (Pay Application)
```
Select approved invoices -> Create draw -> Review G702/G703 -> Submit to client -> Mark funded when paid
```

### 4. Selection Workflow
```
Set allowance in estimate -> Client browses catalog -> Client selects option -> Variance calculated -> Approve/create CO if over
```

---

## Mobile Responsiveness

- All pages should work on tablet (field use common)
- Daily logs, timesheets, photos especially need mobile optimization
- Touch-friendly: 44px minimum touch targets
- Collapsible sidebar on mobile
- Card layouts stack vertically on narrow screens

---

## Empty States

Every list/table should have a meaningful empty state:
- Icon representing the data type
- Clear message: "No invoices yet" not just "No data"
- Primary action CTA: "Upload First Invoice"
- Secondary help text if needed

---

## Loading States

- Skeleton loaders for cards and tables
- Inline spinners for button actions
- Toast notifications for async operations

---

## Additional Notes

1. **No authentication UI needed** - assume user is logged in
2. **API endpoints will be provided** - just need the UI
3. **Dark theme is NOT needed** - light/warm theme only
4. **No real-time features needed initially** - can add later
5. **Focus on information density** - construction professionals want to see lots of data at once
6. **Tables over cards for data** - easier to scan and compare
7. **Inline editing preferred** - click to edit, not always opening modals
8. **Keyboard navigation** - Tab, Enter, Escape for power users

---

## Priority Order

Build in this order:

1. **Navigation shell** (header, sidebar, layout)
2. **Dashboard** (overview)
3. **Job Hub** (job list)
4. **Invoices** (main workflow)
5. **Estimates & Budgets** (core feature)
6. **Purchase Orders**
7. **Draws**
8. **Selections Catalog**
9. **Schedule**
10. **Everything else**

---

## Component Library

If using a component library, prefer:
- **shadcn/ui** - clean, customizable
- **Radix UI** - accessible primitives
- **Tailwind CSS** - for styling

Avoid overly styled libraries that would make customization difficult.

---

# PART 2: ROLE-BASED ACCESS SYSTEM

## Overview

Ross Built CMS has two categories of users:

1. **Internal Users** - Ross Built employees with app access
2. **External Contacts** - Project stakeholders linked to jobs (limited or no app access)

---

## Internal Roles (App Users)

| Role | Level | Description |
|------|-------|-------------|
| **Owner** | 5 | Full access to everything, final authority |
| **Admin** | 4 | Company-wide access, manages settings, employees, vendors |
| **Accounting** | 3.5 | Financial access across all jobs, no operational features |
| **PM** | 3 | Full access to assigned jobs, operational + financial |
| **Supervisor** | 2.5 | Assigned jobs - operational only (no financial approval) |
| **Office** | 2 | Administrative support - data entry, document management |
| **Field Crew** | 1 | Mobile-only: daily logs, photos, timesheets for assigned jobs |

---

## External Contacts (Per-Job Stakeholders)

These are NOT app users (except Client portal). They're contacts linked to jobs:

| Contact Type | Description | Portal Access? |
|--------------|-------------|----------------|
| **Client** | Homeowner/buyer | Yes - Selections, Proposals, Files, Schedule |
| **Designer** | Interior designer | Optional - Selections only |
| **Architect** | Project architect | No - contact info only |
| **Structural Engineer** | Structural engineer | No - contact info only |
| **Vendor** | Material suppliers | No - linked via POs |
| **Subcontractor** | Trade contractors | No - linked via POs/Bids |
| **Owner's Rep** | Client's representative | Optional - same as Client |

---

## Job Team Assignment

Each job has an assigned team:

```
+-----------------------------------------------------------------------------+
| JOB TEAM - Drummond (501 74th St)                                          |
+-----------------------------------------------------------------------------+
|                                                                             |
|  INTERNAL TEAM                           EXTERNAL CONTACTS                  |
|  -------------                           -----------------                  |
|  PM: Jake Ross                           Client: John & Mary Drummond       |
|  Supervisor: Mike Thompson               Designer: Sarah Chen (Interiors)   |
|  Field Crew: [Assigned via crew sched]   Architect: Smith & Associates      |
|                                          Structural: ABC Engineering        |
|                                          Owner's Rep: (none)                |
|                                                                             |
|  [Edit Team]                             [Manage Contacts]                  |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Database Schema for Job Assignment

```sql
-- Job team members (internal users)
v2_job_team (
  id UUID,
  job_id UUID,
  user_id UUID,        -- References employees/users table
  role TEXT,           -- 'pm', 'supervisor', 'field_crew'
  assigned_at TIMESTAMP,
  assigned_by TEXT
)

-- Job contacts (external stakeholders)
v2_job_contacts (
  id UUID,
  job_id UUID,
  contact_type TEXT,   -- 'client', 'designer', 'architect', etc.
  name TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  portal_access BOOLEAN DEFAULT FALSE,
  notes TEXT
)
```

---

## Permission Matrix

### Page Access by Role

| Page | Owner | Admin | Accounting | PM | Supervisor | Office | Field |
|------|-------|-------|------------|-----|------------|--------|-------|
| ***Overview*** |
| **Company Dashboard** | Yes | Yes | Yes | No | No | No | No |
| **Job Hub (all jobs)** | Yes | Yes | Yes | No | No | Yes | No |
| **My Jobs Dashboard** | Yes | Yes | No | Yes | Yes | No | Yes |
| ***Sales*** |
| **Leads (CRM)** | Yes | Yes | No | No | No | No | No |
| ***Pre-Con*** |
| **Estimates** | Yes | Yes | View | Yes | View | No | No |
| **Bids** | Yes | Yes | View | Yes | View | No | No |
| **Selections** | Yes | Yes | No | Yes | Yes | No | No |
| **Proposals** | Yes | Yes | View | Yes | View | No | No |
| **Contracts** | Yes | Yes | Yes | View | No | No | No |
| ***Operations*** |
| **Schedule** | Yes | Yes | No | Yes | Yes | No | View |
| **Daily Logs** | Yes | Yes | No | Yes | Yes | No | Yes |
| **Tasks** | Yes | Yes | No | Yes | Yes | No | Yes |
| **Files** | Yes | Yes | No | Yes | Yes | No | Yes |
| **RFIs** | Yes | Yes | No | Yes | Yes | No | No |
| **Submittals** | Yes | Yes | No | Yes | Yes | No | No |
| **Change Orders** | Yes | Yes | Yes | Yes | View | No | No |
| ***Financial*** |
| **Invoices** | Yes | Yes | Yes | Yes | No | No | No |
| **Purchase Orders** | Yes | Yes | Yes | Yes | View | No | No |
| **Draws** | Yes | Yes | Yes | Yes | No | No | No |
| **Budget** | Yes | Yes | Yes | Yes | View | No | No |
| **Expenses** | Yes | Yes | Yes | No | No | No | No |
| **P&L / Reports** | Yes | Yes | Yes | No | No | No | No |
| **Cash Flow** | Yes | Yes | Yes | No | No | No | No |
| **Overhead** | Yes | Yes | Yes | No | No | No | No |
| **Profitability** | Yes | Yes | Yes | No | No | No | No |
| ***Closeout*** |
| **Punch Lists** | Yes | Yes | No | Yes | Yes | No | Yes |
| **Warranties** | Yes | Yes | No | Yes | Yes | No | No |
| **Lien Releases** | Yes | Yes | Yes | Yes | No | No | No |
| **Final Docs** | Yes | Yes | No | Yes | Yes | No | No |
| ***Settings*** |
| **Vendors** | Yes | Yes | Yes | View | View | View | No |
| **Employees** | Yes | Yes | View | No | No | No | No |
| **Cost Codes** | Yes | Yes | View | No | No | No | No |
| **Timesheets (all)** | Yes | Yes | Yes | No | No | No | No |
| **Timesheets (own)** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Company Settings** | Yes | Yes | No | No | No | No | No |

*Note: PM, Supervisor, Field Crew only see their ASSIGNED jobs*

---

### Action Permissions by Role

| Action | Owner | Admin | Accounting | PM | Supervisor | Office | Field |
|--------|-------|-------|------------|-----|------------|--------|-------|
| **Create Job** | Yes | Yes | No | No | No | No | No |
| **Assign Team** | Yes | Yes | No | No | No | No | No |
| **Approve Invoice** | Yes | Yes | Yes | Yes | No | No | No |
| **Create PO** | Yes | Yes | Yes | Yes | No | No | No |
| **Approve PO** | Yes | Yes | Yes | Yes | No | No | No |
| **Create Change Order** | Yes | Yes | Yes | Yes | No | No | No |
| **Approve Change Order** | Yes | Yes | Yes | Yes | No | No | No |
| **Submit Draw** | Yes | Yes | Yes | Yes | No | No | No |
| **Fund Draw** | Yes | Yes | Yes | No | No | No | No |
| **Generate Proposal** | Yes | Yes | No | Yes | No | No | No |
| **Send Proposal** | Yes | Yes | No | Yes | No | No | No |
| **Add Vendor** | Yes | Yes | Yes | No | No | No | No |
| **Edit Vendor** | Yes | Yes | Yes | No | No | No | No |
| **Add Employee** | Yes | Yes | No | No | No | No | No |
| **Approve Timesheet** | Yes | Yes | Yes | No | No | No | No |
| **Submit Daily Log** | Yes | Yes | No | Yes | Yes | No | Yes |
| **Upload Files** | Yes | Yes | No | Yes | Yes | No | Yes |
| **Create Task** | Yes | Yes | No | Yes | Yes | No | No |
| **Complete Task** | Yes | Yes | No | Yes | Yes | No | Yes |
| **Edit Schedule** | Yes | Yes | No | Yes | Yes | No | No |
| **Manage Selections** | Yes | Yes | No | Yes | Yes | No | No |

---

## Navigation by Role

### Owner / Admin
```
+-----------------------------------------------------------------------------------+
| Ross Built | Overview | Sales | Pre-Con | Operations | Financial | Closeout | Settings |
+-----------------------------------------------------------------------------------+

  Overview        Sales            Pre-Con          Operations       Financial
  - Dashboard     - Leads (CRM)    - Estimates      - Schedule       - Invoices
  - Job Hub                        - Bids           - Daily Logs     - POs
                  Lead -> Won      - Selections     - Tasks          - Draws
  Settings        = Create Job     - Proposals      - Files          - Budget
  - Vendors                        - Contracts      - RFIs           - Expenses
  - Employees                                       - Submittals     - P&L
  - Cost Codes                     Closeout         - Change Orders  - Cash Flow
  - Company                        - Punch Lists                     - Profit
                                   - Warranties
                                   - Lien Releases
                                   - Final Docs
```

### Accounting
```
+-----------------------------------------------------------------------------+
| Ross Built | Overview | Financial | Reports |                               |
+-----------------------------------------------------------------------------+

  Overview        Financial        Reports
  - Dashboard     - Invoices       - P&L
  - Job Hub       - Purchase Ord   - Cash Flow
                  - Draws          - Profitability
  View Only:      - Budget         - WIP
  - Estimates     - Expenses       - Backlog
  - Contracts     - Overhead
  - Vendors       - Timesheets
```

### PM (Project Manager)
```
+-----------------------------------------------------------------------------+
| Ross Built | My Jobs | Pre-Con | Operations | Finance | Closeout |         |
+-----------------------------------------------------------------------------+

  MY JOBS           Pre-Con          Operations       Finance
  (only assigned)   - Estimates      - Schedule       - Invoices
  - Drummond        - Bids           - Daily Logs     - Purchase Orders
  - Crews           - Selections     - Tasks          - Draws
                    - Proposals      - Files          - Budget
  Dashboard shows:                   - RFIs
  - My jobs stats                    - Submittals     Closeout
  - Today's tasks                    - Change Orders  - Punch Lists
  - Pending items                                     - Warranties
                                                      - Final Docs
```

### Supervisor
```
+-----------------------------------------------------------------------------+
| Ross Built | My Jobs | Operations | Closeout |                              |
+-----------------------------------------------------------------------------+

  MY JOBS           Operations       Closeout         View Only:
  (assigned)        - Schedule       - Punch Lists    - Estimates
  - Drummond        - Daily Logs     - Warranties     - Budget
                    - Tasks          - Final Docs     - POs
  Dashboard shows:  - Files                           - Change Orders
  - Job schedule    - RFIs
  - Today's tasks   - Submittals
  - Crews on site   - Selections
```

### Field Crew (Mobile-First)
```
+---------------------+
| Ross Built          |
+---------------------+
| Hi, Mike            |
|                     |
| TODAY'S JOB         |
| +----------------+  |
| | Drummond       |  |
| | 501 74th St    |  |
| | [Navigate]     |  |
| +----------------+  |
|                     |
| QUICK ACTIONS       |
| +-----+ +-----+     |
| |Daily| |Photo|     |
| | Log | |     |     |
| +-----+ +-----+     |
| +-----+ +-----+     |
| |Time | |Tasks|     |
| |Sheet| |     |     |
| +-----+ +-----+     |
|                     |
| MY TASKS TODAY      |
| [ ] Install headers |
| [ ] Frame master    |
| [ ] Stock 2nd floor |
|                     |
+---------------------+
| Home | Logs | Time  |
+---------------------+
```

---

## Client Portal (External)

Clients get a simplified view of their project:

**CLIENT PORTAL ACCESS:**
- Yes: Files (view only)
- Yes: Selections (make choices, approve)
- Yes: Schedule (view milestones)
- Yes: Documents (contracts, specs, warranties)
- Yes: Messages (communicate with PM)
- Yes: Proposals (view, accept)
- No: Budget/Costs (hidden)
- No: Invoices/POs (hidden)
- No: Internal tasks (hidden)

---

## Role Selection UI (Settings)

When Admin creates a user, show role selector with descriptions:
- Owner: Full access to everything
- Admin: Company-wide access, settings management
- Accounting: Financial access across all jobs
- PM: Full access to assigned jobs
- Supervisor: Operational access to assigned jobs
- Office: Administrative support, data entry
- Field Crew: Mobile: daily logs, photos, timesheets

For PM, Supervisor, Field Crew - also show job assignment checkboxes.

---

## Summary

| Internal Role | Sees All Jobs? | Financial Access | Approvals | Mobile Optimized |
|---------------|----------------|------------------|-----------|------------------|
| Owner | Yes | Full | All | No |
| Admin | Yes | Full | All | No |
| Accounting | Yes | Full | Financial only | No |
| PM | Assigned only | Job-level | PO, Invoice, CO | No |
| Supervisor | Assigned only | View only | None | Tablet |
| Office | Yes | None | None | No |
| Field Crew | Assigned only | None | None | Phone |

| External Contact | App Access | What They See |
|------------------|------------|---------------|
| Client | Portal | Files, Selections, Schedule, Documents |
| Designer | Optional Portal | Selections only |
| Others | None | Contact info linked to job |

---

# PART 3: WIREFRAMES & PAGE LAYOUTS

## Complete Workflow Order (Leads -> Warranty)

```
+-----------------------------------------------------------------------------------+
|                         CONSTRUCTION PROJECT LIFECYCLE                            |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  SALES      PRE-CON          OPERATIONS          FINANCIAL        CLOSEOUT       |
|  -----      -------          ----------          ---------        --------       |
|  1. Leads   2. Estimates     7. Schedule         12. Invoices     17. Punch      |
|     |       3. Bids          8. Daily Logs       13. POs          18. Warranty   |
|   (Won)     4. Selections    9. Tasks            14. Draws        19. Liens      |
|     |       5. Proposals     10. RFIs            15. Budget       20. Final      |
|  Create     6. Contracts     11. Change Orders   16. Expenses                    |
|   Job                                                                            |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## Navigation Structure

```
+-----------------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con | Operations | Financial | Closeout | Settings |
+-----------------------------------------------------------------------------------+
|              Dashboard | Job Hub | Vendors | Team | Reports                       |
+-----------------------------------------------------------------------------------+

DROPDOWN MENUS:

[Overview]          [Sales]             [Pre-Con]           [Operations]
- Dashboard         - Leads (CRM)       - Estimates         - Schedule
- Job Hub                               - Bids              - Daily Logs
- Job Profile       Lead -> Won         - Selections        - Tasks
                    = Create Job        - Proposals         - Files
                                        - Contracts         - RFIs
[Financial]         [Closeout]          [Settings]          - Submittals
- Invoices          - Punch Lists       - Vendors           - Change Orders
- Purchase Orders   - Warranties        - Employees
- Draws             - Lien Releases     - Cost Codes
- Budget            - Final Docs        - Company
- Expenses
- Reports
```

---

## Page Layouts

### 1. DASHBOARD (Company Overview)
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview v| Sales | Pre-Con | Operations | Financial | Closeout | Settings |
+-----------------------------------------------------------------------------+
|                                                                             |
|  DASHBOARD                                                                  |
|  Company overview                                                           |
|                                                                             |
|  +-------------+ +-------------+ +-------------+ +-------------+           |
|  | 12          | | $125K       | | 45          | | 3           |           |
|  | Invoices    | | Approved    | | Open POs    | | Expiring    |           |
|  | Pending     | | This Month  | |             | | Vendors     |           |
|  +-------------+ +-------------+ +-------------+ +-------------+           |
|                                                                             |
|  +-----------------------------------+ +-----------------------------------+|
|  | NEEDS ATTENTION                   | | ACTIVE JOBS                      ||
|  | --------------------------------- | | -------------------------------- ||
|  | ! 3 invoices over 30 days        | | Drummond - 501 74th St    75%   ||
|  | ! 2 POs pending approval         | | Crews - 8290 Manasota     45%   ||
|  | ! Draw #4 ready to submit        | | Wilson - 123 Beach Rd     20%   ||
|  | ! 5 selections awaiting          | | Patterson - 456 Gulf      90%   ||
|  +-----------------------------------+ +-----------------------------------+|
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | RECENT ACTIVITY                                                        | |
|  | --------------------------------------------------------------------- | |
|  | 10:30 AM  Invoice #1234 approved by Jake Ross                         | |
|  | 10:15 AM  PO-Drummond501-0043 created for Florida Sunshine Carpentry  | |
|  |  9:45 AM  Draw #3 funded - $45,000                                    | |
|  |  9:30 AM  Daily log submitted for Crews job                           | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

### 2. JOB HUB (All Jobs List)
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview v| Sales | Pre-Con | Operations | Financial | Closeout | Settings |
+-----------------------------------------------------------------------------+
|                                                                             |
|  JOB HUB                                               [+ New Job]          |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | Search jobs...          | Status: [All v] | View: [Cards] [Table]    | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  +-------------------+ +-------------------+ +-------------------+         |
|  | [Photo]           | | [Photo]           | | [Photo]           |         |
|  |                   | |                   | |                   |         |
|  | Drummond          | | Crews             | | Wilson            |         |
|  | 501 74th St       | | 8290 Manasota Key | | 123 Beach Rd      |         |
|  | Client: John D.   | | Client: Sarah C.  | | Client: Mike W.   |         |
|  | ---------------- | | ---------------- | | ----------------  |         |
|  | $1,250,000        | | $890,000          | | $2,100,000        |         |
|  | ======== 75%     | | =====    45%      | | ==       20%      |         |
|  | [Active]          | | [Active]          | | [Active]          |         |
|  +-------------------+ +-------------------+ +-------------------+         |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

### 3. JOB PROFILE (Detail View)
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview v| Sales | Pre-Con | Operations | Financial | Closeout | Settings |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | [Photo]  DRUMMOND - 501 74TH ST                    Status: [Active]   | |
|  |          ----------------------------------------------               | |
|  |          Client: John & Sarah Drummond                                | |
|  |          Address: 501 74th Street, Sarasota, FL 34242                | |
|  |          PM: Mike Johnson  |  Supervisor: Tom Smith                   | |
|  |          Started: Oct 15, 2025  |  Est. Completion: Apr 30, 2026     | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  [Overview] [Financial] [Schedule] [Team] [Documents] [Activity]           |
|  -----------------------------------------------------------------------   |
|                                                                             |
|  +-------------+ +-------------+ +-------------+ +-------------+           |
|  | $1.2M       | | 45%         | | 12          | | 3           |           |
|  | Contract    | | Complete    | | Open Tasks  | | Alerts      |           |
|  +-------------+ +-------------+ +-------------+ +-------------+           |
|                                                                             |
|  +--------------------------------+ +--------------------------------+     |
|  | MILESTONES                     | | RECENT ACTIVITY                |     |
|  | [x] Permit Approved    Oct 20  | | Invoice approved - $17,760     |     |
|  | [x] Foundation Complete Nov 15 | | Daily log submitted            |     |
|  | [x] Framing Complete   Dec 20  | | PO created - Electrical        |     |
|  | [o] Rough-Ins          Jan 30  | | Photo uploaded - Kitchen       |     |
|  | [ ] Drywall            Feb 15  | | Task completed - Frame walls   |     |
|  +--------------------------------+ +--------------------------------+     |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | FINANCIAL SUMMARY                                                      | |
|  | Contract: $1,200,000 | Billed: $540,000 | Paid: $485,000 | Due: $55K  | |
|  | Budget Used: ==================          45%                          | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

### 4. LEADS (CRM Kanban) - Sales Tab
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales v| Pre-Con | Operations | Financial | Closeout | Settings |
+-----------------------------------------------------------------------------+
|                                                                             |
|  LEADS                                                    [+ New Lead]      |
|  Pipeline value: $4.2M                                                      |
|                                                                             |
|  +----------+ +----------+ +----------+ +----------+ +----------+          |
|  | NEW (3)  | |CONTACTED | |QUALIFIED | | PROPOSAL | | WON (2)  |          |
|  |          | |   (2)    | |   (4)    | | SENT (1) | |          |          |
|  +----------+ +----------+ +----------+ +----------+ +----------+          |
|  |+--------+| |+--------+| |+--------+| |+--------+| |+--------+|          |
|  ||Johnson || ||Thompson|| ||Garcia  || ||Roberts || ||Anderson||          |
|  ||$1.2M   || ||$800K   || ||$950K   || ||$1.5M   || ||$1.8M   ||          |
|  ||Referral|| ||Website || ||Referral|| ||Website || ||Referral||          |
|  ||2 days  || ||5 days  || ||12 days || ||3 days  || ||Signed  ||          |
|  |+--------+| |+--------+| |+--------+| |+--------+| |+--------+|          |
|  |+--------+| |+--------+| |+--------+|            | |+--------+|          |
|  ||Martinez|| ||Lee     || ||Brown   ||            | ||Wilson  ||          |
|  ||$2.1M   || ||$650K   || ||$1.1M   ||            | ||$2.1M   ||          |
|  ||Website || ||Referral|| ||Zillow  ||            | ||Signed  ||          |
|  |+--------+| |+--------+| |+--------+|            | |+--------+|          |
|  +----------+ +----------+ +----------+ +----------+ +----------+          |
|                                                                             |
|  <- Drag cards between columns to update status ->                          |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

### 5. ESTIMATES & BUDGETS (Hierarchical Table)
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con v| Operations | Financial | Closeout | Settings |
+-----------------------------------------------------------------------------+
| +---------------+                                                           |
| | JOB SELECTOR  |  JOB: DRUMMOND - 501 74TH ST / ESTIMATE                  |
| | ------------- |  ----------------------------------------------------------
| | Search...     |  Builder Cost $892,450 + Profit 15% = Total $1,026,318   |
| |               |                                                           |
| | * Drummond    |  [+ Add Item] [+ Add Section] [Generate Proposal v] [...]|
| |   501 74th    |  ----------------------------------------------------------
| |   $1.25M      |                                                           |
| |   75% ====    |  +-------------------------------------------------------+|
| |               |  | Description          |Code | Qty|Unit| Cost  |Amount  ||
| | o Crews       |  +-------------------------------------------------------+|
| | o Wilson      |  |v FOUNDATION                              $85,200      ||
| | o Patterson   |  |  v Excavation                            $32,500      ||
| |               |  |    v Footings                            $18,500      ||
| |               |  |      Continuous footings   0310  1  LS   $12,500      ||
| | [+ New Job]   |  |      Pier footings         0310  8  EA   $750         ||
| |               |  |    v Grade Beams                         $14,000      ||
| |               |  |      Grade beam forming    0310  1  LS   $14,000      ||
| |               |  |  v Concrete                              $52,700      ||
| |               |  |v FRAMING                                 $156,800     ||
| |               |  |> MEP ROUGH (collapsed)                   $124,500     ||
| |               |  |> FINISHES (collapsed)                    $285,200     ||
| |               |  |> ALLOWANCES                              $45,000      ||
| |               |  +-------------------------------------------------------+|
| |               |  |                              Subtotal:   $892,450     ||
| |               |  |                              Overhead 8%: $71,396     ||
| |               |  |                              Profit 15%: $133,868     ||
| |               |  |                              TOTAL:    $1,097,714     ||
| +---------------+  +-------------------------------------------------------+|
+-----------------------------------------------------------------------------+
```

---

### 6. INVOICES (Approval Workflow)
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con | Operations | Financial v| Closeout | Settings |
+-----------------------------------------------------------------------------+
| +---------------+                                                           |
| | JOB SELECTOR  |  INVOICES                               [+ Upload PDF]   |
| | ------------- |                                                           |
| | o All Jobs    |  Search...  Status: [Needs Approval v]  [Select Mode]    |
| | * Drummond    |                                                           |
| | o Crews       |  +-------------------------------------------------------+|
| | o Wilson      |  | Vendor           | Invoice # | Date   |Amount|Status  ||
| +---------------+  +-------------------------------------------------------+|
|                    | FL Sunshine Carp | INV-4521  | Jan 18 |$17,760| Yellow||
|                    | Gulf Coast Elec  | 2026-0089 | Jan 17 |$8,450 | Yellow||
|                    | Sarasota Plumb   | SP-1234   | Jan 16 |$12,300| Yellow||
|                    | ABC Concrete     | 78965     | Jan 15 |$24,500| Green ||
|                    | XYZ Roofing      | R-2026-42 | Jan 14 |$18,900| Purple||
|                    +-------------------------------------------------------+|
|                                                                             |
|  STATUS LEGEND: Gray=Received  Yellow=Needs Approval  Green=Approved       |
|                 Purple=In Draw  Blue=Paid                                   |
|                                                                             |
+-----------------------------------------------------------------------------+

INVOICE DETAIL MODAL (Split View):
+-----------------------------------------------------------------------------+
| Invoice: INV-4521 - Florida Sunshine Carpentry                        [X]  |
+--------------------------------+--------------------------------------------+
|                                | INVOICE DETAILS                            |
|      +------------------+      | ------------------------------------       |
|      |                  |      | Vendor: Florida Sunshine Carpentry         |
|      |                  |      | Invoice #: INV-4521                        |
|      |   PDF PREVIEW    |      | Date: January 18, 2026                     |
|      |                  |      | Due: February 17, 2026                     |
|      |   (Scrollable)   |      | Amount: $17,760.00                         |
|      |                  |      |                                            |
|      |                  |      | JOB & PO                                   |
|      |                  |      | Job: [Drummond - 501 74th St v]            |
|      |                  |      | PO: [PO-Drummond501-0043 v]                |
|      |                  |      |                                            |
|      |                  |      | ALLOCATIONS                                |
|      |                  |      | +--------------------------------------+   |
|      |                  |      | | Cost Code        | Amount             |   |
|      |                  |      | | 06100 Rough Carp | $17,760.00         |   |
|      |                  |      | | [+ Add Line]                         |   |
|      |                  |      | +--------------------------------------+   |
|      +------------------+      |                                            |
|                                | Notes: Framing labor for 2nd floor         |
+--------------------------------+--------------------------------------------+
| [Deny]                                           [Save]  [Approve & Stamp] |
+-----------------------------------------------------------------------------+
```

---

### 7. PURCHASE ORDERS
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con | Operations | Financial v| Closeout | Settings |
+-----------------------------------------------------------------------------+
| +---------------+                                                           |
| | JOB SELECTOR  |  PURCHASE ORDERS                           [+ Create PO] |
| | ------------- |                                                           |
| | o All Jobs    |  Search...  Status: [Open v]  Vendor: [All v]            |
| | * Drummond    |                                                           |
| +---------------+  +-------------------------------------------------------+|
|                    | PO #              | Vendor      | Amount  | Invoiced  ||
|                    +-------------------------------------------------------+|
|                    | PO-Drummond-0043  | FL Sunshine | $25,000 | $17,760   ||
|                    | PO-Drummond-0042  | Gulf Coast  | $45,000 | $8,450    ||
|                    | PO-Drummond-0041  | Sarasota Pl | $18,500 | $12,300   ||
|                    | PO-Drummond-0040  | ABC Concrete| $52,700 | $52,700   ||
|                    +-------------------------------------------------------+|
+-----------------------------------------------------------------------------+

PO DETAIL MODAL (Fullscreen with Tabs):
+-----------------------------------------------------------------------------+
| PO-Drummond501-0043 - Florida Sunshine Carpentry                [Approve] X|
+-----------------------------------------------------------------------------+
| [Overview] [Line Items] [Invoices] [Change Orders] [Activity]              |
+-----------------------------------------------------------------------------+
|                                                                             |
|  PO Amount: $25,000.00          Status: Open          Created: Jan 15      |
|  Invoiced:  $17,760.00          Remaining: $7,240.00                       |
|  ==================== 71%                                                   |
|                                                                             |
|  LINE ITEMS                                                                 |
|  +-----------------------------------------------------------------------+ |
|  | # | Cost Code          | Description              | Amount |Invoiced | |
|  +-----------------------------------------------------------------------+ |
|  | 1 | 06100 Rough Carp   | Framing labor - 2nd flr  |$17,500 |$17,760  | |
|  | 2 | 06100 Rough Carp   | Framing labor - roof     | $7,500 | $0      | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  LINKED INVOICES                                                           |
|  +-----------------------------------------------------------------------+ |
|  | INV-4521  | Jan 18, 2026 | $17,760.00 | Approved                       | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

### 8. DRAWS (Pay Applications)
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con | Operations | Financial v| Closeout | Settings |
+-----------------------------------------------------------------------------+
| +---------------+                                                           |
| | JOB SELECTOR  |  DRAWS (Pay Applications)                  [+ New Draw]  |
| | ------------- |                                                           |
| | * Drummond    |  +-------------------------------------------------------+|
| |   Contract:   |  | Draw # | Period      | Amount    | Status             ||
| |   $1,250,000  |  +-------------------------------------------------------+|
| |   Drawn:      |  | #4     | Jan 1-31    | $85,450   | Draft              ||
| |   $562,500    |  | #3     | Dec 1-31    | $125,000  | Funded             ||
| |   ==== 45%    |  | #2     | Nov 1-30    | $187,500  | Funded             ||
| |               |  | #1     | Oct 1-31    | $250,000  | Funded             ||
| +---------------+  +-------------------------------------------------------+|
+-----------------------------------------------------------------------------+

DRAW DETAIL MODAL (Fullscreen with G702/G703):
+-----------------------------------------------------------------------------+
| Draw #4 - Drummond - 501 74th St                    [Export v] [Submit]  X |
+-----------------------------------------------------------------------------+
| [Summary] [G702] [G703 Schedule of Values] [Invoices]                      |
+-----------------------------------------------------------------------------+
|                                                                             |
|  G703 - SCHEDULE OF VALUES                                                 |
|  +-----------------------------------------------------------------------+ |
|  | #  | Cost Code       | Budget   |Previous| This   | Total  | %  |Bal | |
|  +-----------------------------------------------------------------------+ |
|  | 1  | 0100 Gen Cond   | $75,000  |$45,000 |$12,500 |$57,500 |77%|$17K| |
|  | 2  | 0200 Site Work  | $35,000  |$35,000 | $0     |$35,000 |100| $0 | |
|  | 3  | 0310 Concrete   | $85,000  |$85,000 | $0     |$85,000 |100| $0 | |
|  | 4  | 0610 Rough Carp | $125,000 |$62,500 |$42,500 |$105,000|84%|$20K| |
|  | 5  | 0710 Insulation | $18,000  | $0     |$18,000 |$18,000 |100| $0 | |
|  +-----------------------------------------------------------------------+ |
|  |    | TOTALS          |$1,250,000|$562,500|$85,450 |$647,950|52%|$602K||
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  INVOICES IN THIS DRAW (12)                              [+ Add Invoices] |
|  +-----------------------------------------------------------------------+ |
|  | FL Sunshine - INV-4521        | $17,760  | 06100 Rough Carp  | [X]    | |
|  | Gulf Coast - 2026-0089        | $8,450   | 16000 Electrical  | [X]    | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

### 9. SCHEDULE (Gantt Chart)
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con | Operations v| Financial | Closeout | Settings |
+-----------------------------------------------------------------------------+
| +---------------+                                                           |
| | JOB SELECTOR  |  SCHEDULE                      [+ Task] [Baseline v]     |
| | * Drummond    |                                                           |
| +---------------+  Jan 2026                    Feb 2026                    |
|                    | 6  13  20  27 |  3  10  17  24 |  3  10               |
|  +----------------------------------------------------------------------+  |
|  | v FOUNDATION                                                         |  |
|  |   Excavation       ========                                          |  |
|  |   Footings              ==========                                   |  |
|  |   Slab Pour                  ============                            |  |
|  |                                                                      |  |
|  | v FRAMING                                                            |  |
|  |   Floor Framing                   ============                       |  |
|  |   Wall Framing                         ================              |  |
|  |   Roof Framing                                    ==========         |  |
|  |                                                                      |  |
|  | v DRY-IN                                                             |  |
|  |   Roofing                                              ============  |  |
|  |   Windows/Doors                                             ======== |  |
|  |                                                                      |  |
|  | > MEP ROUGH (collapsed)                                              |  |
|  | > INSULATION (collapsed)                                             |  |
|  | > DRYWALL (collapsed)                                                |  |
|  | > FINISHES (collapsed)                                               |  |
|  +----------------------------------------------------------------------+  |
|                                      ^ Today                               |
|  Legend: ==== On Track  ==== Delayed  ==== Complete  ---- Dependency       |
+-----------------------------------------------------------------------------+
```

---

### 10. DAILY LOGS
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con | Operations v| Financial | Closeout | Settings |
+-----------------------------------------------------------------------------+
| +---------------+                                                           |
| | JOB SELECTOR  |  DAILY LOG                             Date: Jan 23, 2026|
| | * Drummond    |                                        [< Prev] [Next >] |
| +---------------+                                                           |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | WEATHER                                                                | |
|  | [Sunny] [Partly] [Cloudy] [Rain] [Storm]                              | |
|  |                                                                        | |
|  | Temperature: [72] F    Wind: [Light v]    Humidity: [45] %            | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | CREWS ON SITE                                                          | |
|  | [x] Framing Crew (5)    [x] Electrical (2)    [ ] Plumbing (0)        | |
|  | [ ] HVAC (0)            [x] Ross Built (3)    [ ] Concrete (0)        | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | WORK PERFORMED                                                         | |
|  | +-------------------------------------------------------------------+ | |
|  | | Completed second floor wall framing. Started on roof trusses.     | | |
|  | | Electrical crew ran rough wiring for kitchen and master bath.     | | |
|  | +-------------------------------------------------------------------+ | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | PHOTOS                                          [+ Add Photos]         | |
|  | +-------+ +-------+ +-------+                                         | |
|  | | [img] | | [img] | | [img] |                                         | |
|  | |Framing| |Trusses| |Wiring |                                         | |
|  | +-------+ +-------+ +-------+                                         | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  [Save Draft]                                              [Submit Log]    |
+-----------------------------------------------------------------------------+
```

---

### 11. FILES (Document Repository)
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con | Operations v| Financial | Closeout | Settings |
+-----------------------------------------------------------------------------+
| +---------------+                                                           |
| | JOB SELECTOR  |  FILES                                    [+ Upload]     |
| | * Drummond    |                                                           |
| | o Crews       |  [All] [Photos] [Plans] [Contracts] [Permits] [Specs]    |
| | o Wilson      |  [Insurance] [Correspondence]                             |
| +---------------+                                                           |
|                    Search: [________________________] View: [Grid v]       |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  |                                                                       | |
|  |  +-------+ +-------+ +-------+ +-------+ +-------+                   | |
|  |  | [Img] | | [Img] | | [Img] | | [Doc] | | [Doc] |                   | |
|  |  |Framing| | Roof  | |Kitchen| |Permit | |Contract|                  | |
|  |  |Jan 20 | |Jan 18 | |Jan 15 | |Dec 10 | |Nov 1  |                   | |
|  |  |Photos | |Photos | |Photos | |Permits| |Contracts|                 | |
|  |  +-------+ +-------+ +-------+ +-------+ +-------+                   | |
|  |                                                                       | |
|  |  +-------+ +-------+ +-------+ +-------+ +-------+                   | |
|  |  | [Dwg] | | [Dwg] | | [Spec]| | [Spec]| | [Ins] |                   | |
|  |  | Floor | | Elec  | | Spec  | |Submittal| | COI |                   | |
|  |  | Plan  | | Plan  | | Sheet | | #42   | |Acme Co|                   | |
|  |  | Plans | | Plans | | Specs | | Specs | |Insurance|                 | |
|  |  +-------+ +-------+ +-------+ +-------+ +-------+                   | |
|  |                                                                       | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | DROP FILES HERE TO UPLOAD                                              | |
|  |                    or click [Browse Files]                             | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

### 12. PUNCH LISTS (Closeout)
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con | Operations | Financial | Closeout v| Settings |
+-----------------------------------------------------------------------------+
| +---------------+                                                           |
| | JOB SELECTOR  |  PUNCH LIST                               [+ Add Item]   |
| | * Patterson   |                                                           |
| |   (Closeout)  |  Progress: 18/25 items complete  ============    72%    |
| +---------------+                                                           |
|                    Filter: [All v]  Assignee: [All v]  Room: [All v]       |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | # | Item                    | Room     | Assigned | Due    |Status    | |
|  +-----------------------------------------------------------------------+ |
|  | 1 | Touch up paint - scuff  | Kitchen  | Painter  | Jan 25 | [ ] Open | |
|  | 2 | Adjust cabinet door     | Kitchen  | Trim     | Jan 25 | [ ] Open | |
|  | 3 | Grout repair - shower   | Master B | Tile     | Jan 24 | [ ] Open | |
|  | 4 | Replace outlet cover    | Bedroom 2| Electric | Jan 24 | [ ] Open | |
|  | 5 | Caulk window sill       | Living   | Trim     | Jan 23 | [ ] Open | |
|  | 6 | Fix squeaky door        | Entry    | Trim     | Jan 23 | [ ] Open | |
|  | 7 | Drywall touch-up        | Garage   | Drywall  | Jan 22 | [ ] Open | |
|  | 8 | Clean windows           | All      | Cleaning | Jan 22 | [x] Done | |
|  | 9 | Install towel bars      | Baths    | Trim     | Jan 21 | [x] Done | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

### 13. VENDORS
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con | Operations | Financial | Closeout | Settings v|
+-----------------------------------------------------------------------------+
|                                                                             |
|  VENDORS                                                  [+ Add Vendor]   |
|                                                                             |
|  Search vendors...    Trade: [All v]    Status: [Active v]                 |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | Vendor                | Trade      | Phone        | Status | Rating   | |
|  +-----------------------------------------------------------------------+ |
|  | Florida Sunshine Carp | Framing    | 941-555-0101 | Active | ****     | |
|  | Gulf Coast Electric   | Electrical | 941-555-0202 | Active | *****    | |
|  | Sarasota Plumbing     | Plumbing   | 941-555-0303 | Active | ****     | |
|  | ABC Concrete          | Concrete   | 941-555-0404 | Expiring| ***     | |
|  | XYZ Roofing           | Roofing    | 941-555-0505 | Expired | ****    | |
|  | Cool Air HVAC         | HVAC       | 941-555-0606 | Active | *****    | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  Legend: Active=Green  Expiring=Yellow  Expired=Red                        |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

### 14. TIMESHEETS
```
+-----------------------------------------------------------------------------+
| Ross Built  | Overview | Sales | Pre-Con | Operations | Financial | Closeout | Settings v|
+-----------------------------------------------------------------------------+
|                                                                             |
|  TIMESHEETS                                Week of: [Jan 20-26, 2026 v]    |
|  Employee: [Jake Ross v]                                                    |
|                                                                             |
|  +-----------------------------------------------------------------------+ |
|  | Job              | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Total    | |
|  +-----------------------------------------------------------------------+ |
|  | Drummond-501     | 4.0 | 6.0 | 8.0 | 4.0 | 2.0 |  -  |  -  | 24.0     | |
|  | Crews-8290       | 4.0 | 2.0 |  -  | 4.0 | 6.0 |  -  |  -  | 16.0     | |
|  | Office/Admin     |  -  |  -  |  -  |  -  |  -  |  -  |  -  |  0.0     | |
|  +-----------------------------------------------------------------------+ |
|  | Daily Total      | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 | 0.0 | 0.0 | 40.0     | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
|  Status: Draft                                          [Submit Week]      |
|                                                                             |
|  RECENT SUBMISSIONS                                                        |
|  +-----------------------------------------------------------------------+ |
|  | Week of Jan 13-19 | 42.0 hrs | [x] Approved                           | |
|  | Week of Jan 6-12  | 38.5 hrs | [x] Approved                           | |
|  | Week of Dec 30-5  | 32.0 hrs | [x] Approved                           | |
|  +-----------------------------------------------------------------------+ |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## Component Reference

### Status Badges
```
[Gray]   Received
[Yellow] Pending
[Green]  Approved
[Purple] In Progress
[Blue]   Complete
[Red]    Overdue
```

### Buttons
```
[Primary Action]   - Blue background, white text
[Secondary]        - Gray border, dark text
[Danger]           - Red background, white text
[Ghost]            - Transparent, text only
```

---

# PART 4: API REFERENCE

**Base URL:** `http://localhost:3001/api`

All responses are JSON. All POST/PATCH/PUT requests expect JSON body with `Content-Type: application/json`.

---

## Jobs

### List Jobs
```
GET /api/jobs
Query: ?status=active|completed|on_hold
Response: [{ id, name, address, client_name, contract_amount, status, created_at }]
```

### Get Job
```
GET /api/jobs/:id
Response: { id, name, address, client_name, contract_amount, status, specs, created_at }
```

### Get Job Budget
```
GET /api/jobs/:id/budget
Response: {
  job: { id, name, contract_amount },
  budget_lines: [{ cost_code, budgeted, committed, billed, paid }],
  totals: { budgeted, committed, billed, paid }
}
```

---

## Invoices

### List Invoices
```
GET /api/invoices
Query: ?status=received|needs_approval|approved|in_draw|paid|denied
       &job_id={uuid}
       &vendor_id={uuid}
Response: [{
  id, job_id, vendor_id, po_id, invoice_number, invoice_date, amount, status,
  pdf_url, pdf_stamped_url, ai_processed, needs_review,
  job: { id, name },
  vendor: { id, name }
}]
```

### Get Invoice
```
GET /api/invoices/:id
Response: { ...invoice, allocations: [{ cost_code_id, amount, cost_code }] }
```

### Process Invoice (AI)
```
POST /api/invoices/process
Body: FormData with 'file' field (PDF)
Response: {
  invoice: { id, ... },
  ai_result: { vendor, job, amount, confidence }
}
```

### Approve Invoice
```
PATCH /api/invoices/:id/approve
Body: { approved_by: "Name" }
Response: { invoice, stamped_url }
```

### Update Invoice
```
PATCH /api/invoices/:id
Body: { job_id?, vendor_id?, po_id?, amount?, invoice_number?, invoice_date?, notes? }
Response: { invoice }
```

### Set Allocations
```
POST /api/invoices/:id/allocate
Body: { allocations: [{ cost_code_id, amount, notes? }] }
Response: { invoice, allocations }
```

### Status Transition
```
POST /api/invoices/:id/transition
Body: { to_status: "approved"|"in_draw"|"paid"|"denied", reason? }
Response: { invoice }
```

### Mark Paid
```
PATCH /api/invoices/:id/mark-paid
Body: { payment_method, payment_reference?, payment_date?, amount_paid? }
Response: { invoice }
```

---

## Purchase Orders

### List POs
```
GET /api/purchase-orders
Query: ?job_id={uuid}&status=open|closed&vendor_id={uuid}
Response: [{
  id, job_id, vendor_id, po_number, description, total_amount, status,
  job: { name }, vendor: { name },
  line_items_count, invoiced_amount
}]
```

### Get PO
```
GET /api/purchase-orders/:id
Response: {
  ...po,
  line_items: [{ cost_code_id, description, amount, invoiced_amount }],
  invoices: [{ id, invoice_number, amount, status }],
  change_orders: [{ id, description, amount, status }]
}
```

### Create PO
```
POST /api/purchase-orders
Body: {
  job_id, vendor_id, description,
  line_items: [{ cost_code_id, description, amount }]
}
Response: { po }
```

### Update PO
```
PATCH /api/purchase-orders/:id
Body: { description?, status?, notes? }
Response: { po }
```

### Approve PO
```
POST /api/purchase-orders/:id/approve
Body: { approved_by: "Name" }
Response: { po }
```

### PO Stats
```
GET /api/pos/stats
Response: { total_open, total_amount, by_job: [{ job_id, count, amount }] }
```

---

## Draws

### List Draws
```
GET /api/draws
Query: ?job_id={uuid}&status=draft|submitted|funded
Response: [{ id, job_id, draw_number, period_end, total_amount, status, job: { name } }]
```

### Get Draw (with G702/G703 data)
```
GET /api/draws/:id
Response: {
  draw: { id, draw_number, period_end, status, ... },
  job: { name, contract_amount, ... },
  invoices: [{ id, vendor, amount, ... }],
  g702: {
    originalContractSum, netChangeOrders, contractSumToDate,
    totalCompletedToDate, totalCompletedThisPeriod,
    retainagePercent, retainageAmount,
    lessPreviousCertificates, currentPaymentDue
  },
  g703: [{
    cost_code, scheduled_value, previous_billings,
    current_billings, total_billed, percent_complete,
    balance_remaining, retainage
  }]
}
```

### Create Draw
```
POST /api/jobs/:id/draws
Body: { period_end: "2026-01-31" }
Response: { draw }
```

### Add Invoices to Draw
```
POST /api/draws/:id/add-invoices
Body: { invoice_ids: [uuid, uuid, ...] }
Response: { draw, added_count }
```

### Remove Invoice from Draw
```
POST /api/draws/:id/remove-invoice
Body: { invoice_id: uuid }
Response: { draw }
```

### Submit Draw
```
PATCH /api/draws/:id/submit
Response: { draw }
```

### Fund Draw
```
PATCH /api/draws/:id/fund
Body: { funded_amount: 50000.00, funded_date?: "2026-01-20" }
Response: { draw }
```

### Export Draw
```
GET /api/draws/:id/export/excel
Response: Excel file download

GET /api/draws/:id/export/pdf
Response: PDF file download
```

---

## Estimates

### List Estimates
```
GET /api/estimates
Query: ?job_id={uuid}&status=draft|sent|approved|converted
Response: [{ id, job_id, name, status, subtotal, total, job: { name } }]
```

### Get Estimate
```
GET /api/estimates/:id
Response: {
  estimate: { id, name, status, subtotal, overhead_percent, profit_percent, total, ... },
  phases: [{
    id, name, subtotal,
    groups: [{
      id, name, subtotal,
      subgroups: [{
        id, name, subtotal,
        line_items: [{ id, description, quantity, unit, unit_cost, line_total, is_allowance }]
      }]
    }]
  }]
}
```

### Create Estimate
```
POST /api/estimates
Body: { job_id, name, template_id? }
Response: { estimate }
```

### Update Estimate
```
PATCH /api/estimates/:id
Body: { name?, overhead_percent?, profit_percent?, contingency_percent?, status? }
Response: { estimate }
```

### Add Line Item
```
POST /api/estimates/:id/line-items
Body: { subgroup_id, cost_code_id?, description, quantity, unit, unit_cost, is_allowance? }
Response: { line_item }
```

### Update Line Item
```
PATCH /api/estimate-line-items/:id
Body: { description?, quantity?, unit?, unit_cost?, is_allowance? }
Response: { line_item }
```

### Delete Line Item
```
DELETE /api/estimate-line-items/:id
Response: { success: true }
```

### Add Phase
```
POST /api/estimates/:id/phases
Body: { name, phase_code? }
Response: { phase }
```

### Add Group
```
POST /api/estimate-phases/:id/groups
Body: { name }
Response: { group }
```

### Add Subgroup
```
POST /api/estimate-groups/:id/subgroups
Body: { name }
Response: { subgroup }
```

---

## Proposals

### Generate Proposal
```
POST /api/proposals
Body: { estimate_id, detail_level: "summary"|"line_items", include_allowances: true }
Response: { proposal: { id, proposal_number, share_token, pdf_url } }
```

### Get Proposal (by share token)
```
GET /api/proposals/share/:token
Response: {
  proposal: { ... },
  estimate: { ... },
  job: { ... },
  company: { name, logo_url, phone, email, address }
}
```

### Accept Proposal
```
POST /api/proposals/:id/accept
Body: { name: "Client Name", email: "client@email.com" }
Response: { proposal, estimate }
```

---

## Vendors

### List Vendors
```
GET /api/vendors
Query: ?trade={trade}&status=active|expiring|expired
Response: [{ id, name, email, phone, trade, status, insurance_expiry, license_expiry }]
```

### Get Vendor
```
GET /api/vendors/:id
Response: {
  vendor: { ... },
  purchase_orders: [{ id, po_number, amount, status }],
  invoices: [{ id, invoice_number, amount, status }],
  documents: [{ id, name, type, url }],
  scorecard: { quality, reliability, speed, overall }
}
```

### Create Vendor
```
POST /api/vendors
Body: { name, email?, phone?, trade? }
Response: { vendor }
```

### Update Vendor
```
PATCH /api/vendors/:id
Body: { name?, email?, phone?, trade?, insurance_expiry?, license_expiry? }
Response: { vendor }
```

---

## Cost Codes

### List Cost Codes
```
GET /api/cost-codes
Response: [{ id, code, name, category }]
```

---

## Selections (Catalog)

### List Categories
```
GET /api/selections/categories
Response: [{ id, name, parent_id, image_url, product_count }]
```

### List Products
```
GET /api/selections/products
Query: ?category_id={uuid}&tier=builder|standard|premium&min_price=&max_price=&search=
Response: [{
  id, name, brand, price, image_url, category, quality_tier,
  specs, lead_time_days
}]
```

### Get Product
```
GET /api/selections/products/:id
Response: { product, variants?, related_products? }
```

---

## Dashboard

### Get Dashboard Stats
```
GET /api/dashboard/stats
Response: {
  pending_invoices: 12,
  approved_this_month: 125000.00,
  open_pos: 45,
  expiring_vendors: 3,
  recent_activity: [{ type, description, timestamp }],
  alerts: [{ type, message, severity }]
}
```

---

## Schedule

### Get Schedule Tasks
```
GET /api/schedule/tasks
Query: ?job_id={uuid}
Response: [{
  id, job_id, name, start_date, end_date, duration_days,
  assigned_crew, phase, status, dependencies: [task_id, ...]
}]
```

### Update Task
```
PATCH /api/schedule/tasks/:id
Body: { start_date?, end_date?, assigned_crew?, status? }
Response: { task }
```

---

## Employees

### List Employees
```
GET /api/employees
Response: [{ id, name, email, phone, role, burden_class, status }]
```

### Get Employee
```
GET /api/employees/:id
Response: { employee, timesheets: [], assignments: [] }
```

---

## Timesheets

### Get Timesheet
```
GET /api/timesheets
Query: ?employee_id={uuid}&week_start={date}
Response: {
  employee: { ... },
  entries: [{ job_id, date, hours, notes, job: { name } }],
  totals: { by_day: {}, by_job: {}, total_hours }
}
```

### Submit Timesheet Entry
```
POST /api/timesheets
Body: { employee_id?, job_id, date, hours, notes? }
Response: { entry }
```

---

## Expenses

### List Expenses
```
GET /api/expenses
Query: ?period_id={uuid}&category={category}&vendor_id={uuid}
Response: [{ id, date, vendor_id, category, amount, is_recurring, receipt_url, vendor: { name } }]
```

### Create Expense
```
POST /api/expenses
Body: { date, vendor_id?, category, amount, is_recurring?, receipt_url?, notes? }
Response: { expense }
```

---

## Daily Logs

### Get Daily Log
```
GET /api/daily-logs/:jobId/:date
Response: {
  log: { weather, temperature, work_performed, deliveries, visitors, safety_incidents },
  crews_on_site: [{ id, name }],
  photos: [{ id, url, caption }]
}
```

### Save Daily Log
```
POST /api/daily-logs
Body: { job_id, date, weather, temperature?, work_performed, crews_on_site: [], deliveries?, visitors?, safety_incidents? }
Response: { log }
```

---

## File Upload

### Upload File
```
POST /api/files/upload
Body: FormData with 'file' field
Query: ?bucket=invoices|documents|photos|receipts
Response: { url, filename, size }
```

---

## Error Responses

All errors return:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

Common error codes:
- `NOT_FOUND` - Resource doesn't exist
- `VALIDATION_ERROR` - Invalid input
- `DUPLICATE` - Resource already exists
- `LOCKED` - Resource is locked by another user
- `UNAUTHORIZED` - Not authorized for this action

---

## Pagination

Large lists support pagination:
```
GET /api/invoices?page=1&limit=50
Response: {
  data: [...],
  pagination: {
    page: 1,
    limit: 50,
    total: 245,
    pages: 5
  }
}
```

---

## Notes for Frontend Integration

1. **UUID format:** All IDs are UUIDs (e.g., `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`)

2. **Date format:** All dates are ISO 8601 (`"2026-01-23"` for dates, `"2026-01-23T14:30:00Z"` for timestamps)

3. **Currency:** All monetary values are decimal numbers (e.g., `12500.00`), format on frontend

4. **Status values are lowercase:** `"approved"` not `"Approved"`

5. **Soft deletes:** Deleted items have `deleted_at` timestamp, not returned in lists by default

6. **Realtime:** SSE endpoint available at `/api/realtime/events` for live updates (optional)

7. **CORS:** API allows all origins in development

---

*This document was generated from an existing codebase with 120+ files and 110,000+ lines of JavaScript. The backend API exists and is functional - we need a modern, beautiful frontend to replace the current vanilla JS implementation.*
