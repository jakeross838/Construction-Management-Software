# Ross Built Construction Management System
## Complete Project Overview

---

# PART 1: SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
│                    React + TypeScript + Tailwind                     │
│                      http://localhost:3001                           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EXPRESS SERVER                               │
│                    Node.js on Port 3001                              │
│                    /api/* endpoints                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          SUPABASE                                    │
│              PostgreSQL Database + File Storage                      │
│            https://sorghqcpeamdfbvysafj.supabase.co                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

# PART 2: MAIN NAVIGATION

```
SIDEBAR MENU
│
├── DASHBOARD ────────────────────── Overview & KPIs
│
├── FINANCIAL
│   ├── Invoices ─────────────────── Vendor invoice management
│   ├── Purchase Orders ──────────── PO creation & tracking
│   ├── Draws ────────────────────── G702/G703 pay applications
│   └── Proposals ────────────────── Client proposals
│
├── PROJECTS
│   ├── Jobs ─────────────────────── Project management
│   ├── Estimates ────────────────── Cost estimating
│   ├── Schedules ────────────────── Project timelines
│   └── Daily Logs ───────────────── Field reports
│
├── BIDDING
│   └── Bid Packages ─────────────── Subcontractor bidding
│
└── ADMIN
    ├── Vendors ──────────────────── Subcontractor directory
    ├── Cost Codes ───────────────── Budget categories
    ├── Users ────────────────────── User management
    └── Settings ─────────────────── App configuration
```

---

# PART 3: CORE BUSINESS FLOWS

## Flow 1: New Project Setup

```
START NEW PROJECT
       │
       ▼
┌──────────────┐
│  CREATE JOB  │  Jobs page → New Job
│              │  - Client name
│              │  - Address
│              │  - Contract amount
└──────────────┘
       │
       ▼
┌──────────────┐
│ SET BUDGET   │  Job Detail → Budget tab
│              │  - Allocate $ to cost codes
│              │  - 06100 Carpentry: $50,000
│              │  - 26000 Electrical: $30,000
└──────────────┘
       │
       ▼
┌──────────────┐
│ CREATE BID   │  Bids page → New Package
│  PACKAGES    │  - One per trade
│              │  - Upload specs/drawings
└──────────────┘
       │
       ▼
┌──────────────┐
│ COLLECT BIDS │  Bid Detail → Add Bids
│              │  - Enter vendor quotes
│              │  - Compare in table
└──────────────┘
       │
       ▼
┌──────────────┐
│ AWARD & CREATE │  Bid Detail → Award
│     PO         │  - Select winning vendor
│                │  - Auto-creates PO
└────────────────┘
```

---

## Flow 2: Invoice Processing (AI-Powered)

```
VENDOR SENDS INVOICE
       │
       ▼
┌──────────────────┐
│  UPLOAD PDF      │  Invoices page → Upload
│                  │  - Drag & drop PDF
│                  │  - AI processes automatically
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  AI EXTRACTION   │  Claude AI extracts:
│                  │  - Vendor name
│                  │  - Invoice number
│                  │  - Amount
│                  │  - Date
│                  │  - Line items
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  AUTO-MATCHING   │  System matches:
│                  │  - Job (from context)
│                  │  - Vendor (fuzzy match)
│                  │  - PO (if referenced)
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  REVIEW FLAGS    │  Flags if:
│                  │  - No PO match
│                  │  - Amount > PO remaining
│                  │  - Duplicate detected
│                  │  - Low confidence
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  PM APPROVAL     │  Invoice Detail:
│                  │  - Review AI data
│                  │  - Allocate to cost codes
│                  │  - Click APPROVE
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  PDF STAMPED     │  Stamp added:
│                  │  - APPROVED
│                  │  - Date, By, Job
│                  │  - Cost codes
│                  │  - PO info
└──────────────────┘
       │
       ▼
   READY FOR DRAW
```

---

## Flow 3: Draw Request (G702/G703)

```
APPROVED INVOICES READY
       │
       ▼
┌──────────────────┐
│  CREATE DRAW     │  Draws page → New Draw
│                  │  - Select job
│                  │  - Set period end date
│                  │  - Application #
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  ADD INVOICES    │  Draw Detail → Invoices tab
│                  │  - Select approved invoices
│                  │  - Add to draw
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  G703 GENERATED  │  Schedule of Values:
│                  │  ┌─────────────────────────────────┐
│                  │  │ Cost Code │ Budget │ This Draw │
│                  │  │ Carpentry │ 50,000 │   12,000  │
│                  │  │ Electric  │ 30,000 │    8,000  │
│                  │  └─────────────────────────────────┘
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  G702 GENERATED  │  Payment Application:
│                  │  - Original contract: $500,000
│                  │  - Completed to date: $120,000
│                  │  - Less retainage (10%): $12,000
│                  │  - Current payment due: $20,000
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  EXPORT & SUBMIT │  - Export to Excel
│                  │  - Export to PDF
│                  │  - Submit to client
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  MARK FUNDED     │  When client pays:
│                  │  - Record funded amount
│                  │  - Update job financials
└──────────────────┘
```

---

## Flow 4: Purchase Order Lifecycle

```
NEED TO HIRE SUBCONTRACTOR
       │
       ▼
┌──────────────────┐
│  CREATE PO       │  POs page → New PO
│                  │  - Select job
│                  │  - Select vendor
│                  │  - Add line items by cost code
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  ADD LINE ITEMS  │  Line Items:
│                  │  - 06100 Framing: $25,000
│                  │  - 06200 Finish: $15,000
│                  │  - Total: $40,000
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  SCOPE TRACKING  │  Performance Intelligence:
│  (Optional)      │  - Scope: "Framing"
│                  │  - Quantity: 2,400 SF
│                  │  - Est. Days: 4.8
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  APPROVE PO      │  Status: APPROVED
│                  │  - Ready for work
│                  │  - Can receive invoices
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  RECEIVE         │  As invoices come in:
│  INVOICES        │  - Link to PO
│                  │  - Track billed vs committed
│                  │  - Progress bar updates
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  CHANGE ORDERS   │  If scope changes:
│  (If needed)     │  - Create CO
│                  │  - Add/subtract amount
│                  │  - Links to invoices
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  CLOSE PO        │  When complete:
│                  │  - Fully billed
│                  │  - Status: CLOSED
└──────────────────┘
```

---

## Flow 5: Daily Field Reporting

```
DAILY SITE ACTIVITY
       │
       ▼
┌──────────────────┐
│  CREATE LOG      │  Daily Logs → New Log
│                  │  - Select job
│                  │  - Set date
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  WEATHER         │  Weather conditions:
│                  │  - Temperature
│                  │  - Conditions (sunny, rain)
│                  │  - Delays noted
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  CREW ENTRIES    │  For each trade on site:
│                  │  - Vendor/Company
│                  │  - Headcount
│                  │  - Hours worked
│                  │  - Work description
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  PERFORMANCE     │  Scope tracking:
│  TRACKING        │  - Scope category (Tile, etc)
│                  │  - Quantity completed
│                  │  - Work quality rating
│                  │  - Ready for next trade?
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  MATERIALS       │  Deliveries received:
│                  │  - Item description
│                  │  - Quantity
│                  │  - Vendor
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  VISITORS        │  Site visitors:
│                  │  - Name, company
│                  │  - Purpose
│                  │  - Time in/out
└──────────────────┘
       │
       ▼
   LOG SAVED → PERFORMANCE DATA AGGREGATED
```

---

# PART 4: PAGE-BY-PAGE BREAKDOWN

## DASHBOARD (`/`)

**Purpose:** High-level overview of all operations

**Shows:**
- Active jobs count
- Pending invoices count
- Open PO value
- Draws in progress
- Recent activity feed
- Charts and KPIs

**Links to:**
- Click stat card → Goes to relevant page
- Click activity item → Opens detail

---

## INVOICES (`/invoices`)

**Purpose:** Manage all vendor invoices

**Features:**
| Feature | Description |
|---------|-------------|
| Filter by status | All Active, Needs Approval, Approved, In Draw |
| Filter by job | Dropdown of all jobs |
| AI Upload | Drag PDF → AI extracts data |
| Bulk actions | Approve multiple, add to draw |

**Invoice Statuses:**
```
received → needs_approval → approved → in_draw → paid
                ↓
              denied
```

**Components:**
- `Invoices.tsx` - Main page
- `InvoiceUploadDialog.tsx` - AI upload modal
- `InvoiceDetailDialog.tsx` - View/edit invoice
- `AIProcessingAnimation.tsx` - Upload progress

**API Endpoints:**
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/invoices` | List with filters |
| GET | `/api/invoices/:id` | Get one with allocations |
| POST | `/api/invoices/process` | AI upload |
| PATCH | `/api/invoices/:id/approve` | Approve + stamp |
| POST | `/api/invoices/:id/allocate` | Set cost codes |

**Database Tables:**
- `v2_invoices` - Main invoice data
- `v2_invoice_allocations` - Cost code splits

---

## PURCHASE ORDERS (`/purchase-orders`)

**Purpose:** Create and track subcontractor commitments

**Features:**
| Feature | Description |
|---------|-------------|
| Filter by status | Open, Closed, Cancelled |
| Filter by job | Dropdown of all jobs |
| Create PO | Multi-step form with line items |
| Track billing | Progress bar: billed vs committed |

**PO Statuses:**
```
pending → approved → active → closed
              ↓
          cancelled
```

**Components:**
- `PurchaseOrders.tsx` - Main page
- `POFormDialog.tsx` - Create/edit with scope tracking
- `PODetailDialog.tsx` - Full detail view with tabs

**Detail Dialog Tabs:**
1. **Overview** - Summary, totals, progress
2. **Line Items** - Cost code breakdown
3. **Invoices** - Linked invoices list
4. **Change Orders** - CO history
5. **Activity** - Audit log

**API Endpoints:**
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/purchase-orders` | List with filters |
| GET | `/api/purchase-orders/:id` | Full detail |
| POST | `/api/purchase-orders` | Create |
| PATCH | `/api/purchase-orders/:id` | Update |
| POST | `/api/purchase-orders/:id/approve` | Approve |

**Database Tables:**
- `v2_purchase_orders` - Main PO data
- `v2_po_line_items` - Line items by cost code
- `v2_change_orders` - Change orders
- `v2_po_activity` - Audit log

---

## DRAWS (`/draws`)

**Purpose:** Generate AIA G702/G703 pay applications

**Features:**
| Feature | Description |
|---------|-------------|
| Create draw | For any job |
| Add invoices | From approved invoices |
| G702 tab | Payment application summary |
| G703 tab | Schedule of values by cost code |
| Export | Excel and PDF |

**Draw Statuses:**
```
draft → submitted → funded
```

**Components:**
- `Draws.tsx` - Main page
- `DrawDetailDialog.tsx` - Full detail view
- `G702Tab.tsx` - Payment application
- `G703Tab.tsx` - Schedule of values

**G702 Calculations:**
```
Original Contract Sum.............$500,000
Net Change Orders.................$  5,000
Contract Sum to Date..............$505,000
Total Completed to Date...........$120,000
Retainage (10%)...................$-12,000
Less Previous Certificates........$-80,000
CURRENT PAYMENT DUE..............$ 28,000
```

**G703 Columns:**
| # | Cost Code | Budget | Previous | Current | Total | % | Balance | Retainage |
|---|-----------|--------|----------|---------|-------|---|---------|-----------|

**API Endpoints:**
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/draws` | List all |
| GET | `/api/draws/:id` | With G702/G703 data |
| POST | `/api/jobs/:id/draws` | Create for job |
| POST | `/api/draws/:id/add-invoices` | Add invoices |
| GET | `/api/draws/:id/export/excel` | Excel export |
| GET | `/api/draws/:id/export/pdf` | PDF export |

**Database Tables:**
- `v2_draws` - Draw header
- `v2_draw_invoices` - Junction to invoices

---

## BIDS (`/bids`)

**Purpose:** Manage bid packages and subcontractor quotes

**Features:**
| Feature | Description |
|---------|-------------|
| Bid packages | One per trade per job |
| Upload specs | Attach drawings/documents |
| Collect bids | Enter vendor quotes |
| Compare bids | Side-by-side table |
| Award | Select winner → Creates PO |

**Package Statuses:**
```
draft → issued → evaluating → awarded
```

**Components:**
- `Bids.tsx` - Main page (grouped by job)
- `BidPackageFormDialog.tsx` - Create/edit package
- `BidPackageDetailDialog.tsx` - View with bids
- `BidComparisonView.tsx` - Compare vendors
- `SubcontractorBidFormDialog.tsx` - Enter bid

**API Endpoints:**
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/bids` | List packages |
| GET | `/api/bids/:id` | With subcontractor bids |
| POST | `/api/bids` | Create package |
| POST | `/api/bids/:id/subcontractor-bids` | Add vendor bid |
| POST | `/api/bids/:id/award` | Award + create PO |

**Database Tables:**
- `v2_bids` - Bid packages
- `v2_bid_documents` - Specs/drawings
- `v2_subcontractor_bids` - Vendor quotes
- `v2_subcontractor_bid_documents` - Vendor proposals

---

## DAILY LOGS (`/daily-logs`)

**Purpose:** Field reports with crew and performance tracking

**Features:**
| Feature | Description |
|---------|-------------|
| Create log | Per job per day |
| Weather | Conditions and delays |
| Crew entries | Who worked, hours, tasks |
| Performance | Scope tracking for analytics |
| Materials | Deliveries received |
| Visitors | Site visitor log |

**Components:**
- `DailyLogs.tsx` - Main page
- `DailyLogFormDialog.tsx` - Create/edit with all sections
- `DailyLogDetailDialog.tsx` - View log

**Crew Entry Fields:**
```
Company/Vendor: [Select vendor]
Headcount: [Number]
Hours: [Number]
Work Performed: [Text]

--- Performance Tracking ---
Scope Category: [Select - Tile, Framing, etc]
Qty Completed: [Number] [units - SF, LF, EA]
Work Quality: [Poor/Acceptable/Good/Excellent]
Ready for Next Trade: [Checkbox]
```

**API Endpoints:**
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/daily-logs` | List logs |
| GET | `/api/daily-logs/:id` | Full log |
| POST | `/api/daily-logs` | Create |
| PATCH | `/api/daily-logs/:id` | Update |

**Database Tables:**
- `v2_daily_logs` - Log header
- `v2_daily_log_crew` - Crew entries
- `v2_daily_log_weather` - Weather
- `v2_daily_log_materials` - Materials
- `v2_daily_log_visitors` - Visitors

---

## JOBS (`/jobs`)

**Purpose:** Project management hub

**Features:**
| Feature | Description |
|---------|-------------|
| Job list | All projects with status |
| Create job | Client, address, contract |
| Job detail | Dashboard for single project |
| Budget | Allocate to cost codes |

**Job Detail Tabs:**
1. **Overview** - Summary, key metrics
2. **Budget** - Cost codes with budget/actual
3. **Invoices** - All invoices for job
4. **POs** - All POs for job
5. **Draws** - Draw history
6. **Documents** - Attached files

**API Endpoints:**
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/jobs` | List jobs |
| GET | `/api/jobs/:id` | Job detail |
| POST | `/api/jobs` | Create |
| PATCH | `/api/jobs/:id` | Update |
| GET | `/api/jobs/:id/budget` | Budget with actuals |

**Database Tables:**
- `v2_jobs` - Job header
- `v2_budget_lines` - Budget by cost code

---

## VENDORS (`/vendors`)

**Purpose:** Subcontractor and supplier directory

**Features:**
| Feature | Description |
|---------|-------------|
| Vendor list | All companies |
| Create vendor | Name, contact, address |
| Vendor detail | Contact info, history |
| Duplicate detection | AI finds potential dupes |

**API Endpoints:**
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/vendors` | List vendors |
| GET | `/api/vendors/:id` | Vendor detail |
| POST | `/api/vendors` | Create |
| GET | `/api/vendors/duplicates` | Find duplicates |

**Database Tables:**
- `v2_vendors` - Vendor records

---

## COST CODES (`/cost-codes`)

**Purpose:** Standard budget categories

**Features:**
| Feature | Description |
|---------|-------------|
| Code list | All cost codes |
| Categories | Grouped by type |
| Standard codes | 06100, 26000, etc |

**Standard Cost Codes:**
```
01000 - General Conditions
02000 - Site Work
03000 - Concrete
04000 - Masonry
05000 - Metals
06000 - Wood & Plastics
  06100 - Rough Carpentry
  06200 - Finish Carpentry
07000 - Thermal & Moisture
08000 - Doors & Windows
09000 - Finishes
  09300 - Tile
  09900 - Painting
10000 - Specialties
15000 - Mechanical
16000 - Electrical
26000 - Electrical (alternate)
```

**Database Tables:**
- `v2_cost_codes` - Code definitions

---

# PART 5: DATABASE SCHEMA

## Core Tables

```
┌─────────────────────────────────────────────────────────────┐
│ v2_jobs                                                     │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ name            TEXT         "Drummond-501 74th St"         │
│ address         TEXT                                        │
│ client_name     TEXT                                        │
│ contract_amount DECIMAL(12,2)                               │
│ status          TEXT         active/completed/on_hold       │
│ created_at      TIMESTAMPTZ                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_vendors                                                  │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ name            TEXT                                        │
│ email           TEXT                                        │
│ phone           TEXT                                        │
│ address         TEXT                                        │
│ contact_name    TEXT                                        │
│ created_at      TIMESTAMPTZ                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_cost_codes                                               │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ code            TEXT         "06100"                        │
│ name            TEXT         "Rough Carpentry"              │
│ category        TEXT                                        │
└─────────────────────────────────────────────────────────────┘
```

## Financial Tables

```
┌─────────────────────────────────────────────────────────────┐
│ v2_invoices                                                 │
├─────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                          │
│ job_id            UUID → v2_jobs                            │
│ vendor_id         UUID → v2_vendors                         │
│ po_id             UUID → v2_purchase_orders                 │
│ invoice_number    TEXT                                      │
│ invoice_date      DATE                                      │
│ due_date          DATE                                      │
│ amount            DECIMAL(12,2)                             │
│ status            TEXT  received/needs_approval/approved/   │
│                         in_draw/paid/denied                 │
│ pdf_url           TEXT                                      │
│ pdf_stamped_url   TEXT                                      │
│ ai_processed      BOOLEAN                                   │
│ ai_confidence     JSONB                                     │
│ ai_extracted_data JSONB                                     │
│ needs_review      BOOLEAN                                   │
│ review_flags      TEXT[]                                    │
│ approved_at       TIMESTAMPTZ                               │
│ approved_by       TEXT                                      │
│ notes             TEXT                                      │
│ deleted_at        TIMESTAMPTZ                               │
│ created_at        TIMESTAMPTZ                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_invoice_allocations                                      │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ invoice_id      UUID → v2_invoices                          │
│ job_id          UUID → v2_jobs                              │
│ cost_code_id    UUID → v2_cost_codes                        │
│ amount          DECIMAL(12,2)                               │
│ notes           TEXT                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_purchase_orders                                          │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                        │
│ job_id              UUID → v2_jobs                          │
│ vendor_id           UUID → v2_vendors                       │
│ po_number           TEXT         "PO-Drummond501-0001"      │
│ description         TEXT                                    │
│ total_amount        DECIMAL(12,2)                           │
│ status              TEXT         open/closed/cancelled      │
│ approval_status     TEXT         pending/approved/rejected  │
│ approved_at         TIMESTAMPTZ                             │
│ approved_by         TEXT                                    │
│ scope_category_id   UUID → v2_scope_categories              │
│ scope_quantity      DECIMAL(12,2)                           │
│ estimated_days      DECIMAL(8,2)                            │
│ scope_of_work       TEXT                                    │
│ notes               TEXT                                    │
│ deleted_at          TIMESTAMPTZ                             │
│ created_at          TIMESTAMPTZ                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_po_line_items                                            │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ po_id           UUID → v2_purchase_orders                   │
│ cost_code_id    UUID → v2_cost_codes                        │
│ description     TEXT                                        │
│ amount          DECIMAL(12,2)                               │
│ invoiced_amount DECIMAL(12,2)                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_draws                                                    │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ job_id          UUID → v2_jobs                              │
│ draw_number     INTEGER                                     │
│ period_end      DATE                                        │
│ total_amount    DECIMAL(12,2)                               │
│ status          TEXT         draft/submitted/funded         │
│ submitted_at    TIMESTAMPTZ                                 │
│ funded_at       TIMESTAMPTZ                                 │
│ funded_amount   DECIMAL(12,2)                               │
│ created_at      TIMESTAMPTZ                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_draw_invoices                                            │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ draw_id         UUID → v2_draws                             │
│ invoice_id      UUID → v2_invoices                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_budget_lines                                             │
├─────────────────────────────────────────────────────────────┤
│ id               UUID PRIMARY KEY                           │
│ job_id           UUID → v2_jobs                             │
│ cost_code_id     UUID → v2_cost_codes                       │
│ budgeted_amount  DECIMAL(12,2)                              │
│ committed_amount DECIMAL(12,2)                              │
│ billed_amount    DECIMAL(12,2)                              │
│ paid_amount      DECIMAL(12,2)                              │
└─────────────────────────────────────────────────────────────┘
```

## Bidding Tables

```
┌─────────────────────────────────────────────────────────────┐
│ v2_bids (Bid Packages)                                      │
├─────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                          │
│ job_id            UUID → v2_jobs                            │
│ package_number    TEXT                                      │
│ trade_category    TEXT         "Electrical"                 │
│ title             TEXT                                      │
│ description       TEXT                                      │
│ issue_date        DATE                                      │
│ due_date          DATE                                      │
│ status            TEXT  draft/issued/evaluating/awarded     │
│ awarded_vendor_id UUID → v2_vendors                         │
│ awarded_at        TIMESTAMPTZ                               │
│ awarded_amount    DECIMAL(12,2)                             │
│ created_at        TIMESTAMPTZ                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_subcontractor_bids                                       │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ bid_package_id  UUID → v2_bids                              │
│ vendor_id       UUID → v2_vendors                           │
│ amount          DECIMAL(12,2)                               │
│ notes           TEXT                                        │
│ submitted_at    TIMESTAMPTZ                                 │
│ status          TEXT         pending/accepted/rejected      │
└─────────────────────────────────────────────────────────────┘
```

## Daily Log Tables

```
┌─────────────────────────────────────────────────────────────┐
│ v2_daily_logs                                               │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ job_id          UUID → v2_jobs                              │
│ log_date        DATE                                        │
│ notes           TEXT                                        │
│ created_by      UUID → v2_users                             │
│ created_at      TIMESTAMPTZ                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_daily_log_crew                                           │
├─────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                        │
│ daily_log_id        UUID → v2_daily_logs                    │
│ vendor_id           UUID → v2_vendors                       │
│ company_name        TEXT                                    │
│ headcount           INTEGER                                 │
│ hours               DECIMAL(4,1)                            │
│ work_performed      TEXT                                    │
│ scope_category_id   UUID → v2_scope_categories              │
│ quantity_completed  DECIMAL(12,2)                           │
│ work_quality        TEXT  poor/acceptable/good/excellent    │
│ ready_for_next_trade BOOLEAN                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ v2_daily_log_weather                                        │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ daily_log_id    UUID → v2_daily_logs                        │
│ temperature     INTEGER                                     │
│ conditions      TEXT                                        │
│ precipitation   TEXT                                        │
│ wind            TEXT                                        │
│ delays          TEXT                                        │
└─────────────────────────────────────────────────────────────┘
```

## Performance Intelligence Tables

```
┌─────────────────────────────────────────────────────────────┐
│ v2_scope_categories                                         │
├─────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                      │
│ code                  TEXT         "TILE"                   │
│ name                  TEXT         "Tile Installation"      │
│ trade                 TEXT         "Finishes"               │
│ description           TEXT                                  │
│ primary_unit          TEXT         SF/LF/EA/LS/SY           │
│ baseline_days_per_unit DECIMAL(8,4) 0.015                   │
│ baseline_cost_per_unit DECIMAL(12,2)                        │
│ typical_crew_size     INTEGER                               │
└─────────────────────────────────────────────────────────────┘

27 predefined categories:
- Framing, Drywall, Insulation
- Tile, Flooring, Painting
- Electrical Rough, Electrical Trim
- Plumbing Rough, Plumbing Trim
- HVAC Rough, HVAC Trim
- Roofing, Siding, Windows
- Cabinets, Countertops, Trim Carpentry
- Concrete, Masonry, Excavation
- Landscaping, Fencing
- Appliances, Fixtures, Cleanup

┌─────────────────────────────────────────────────────────────┐
│ v2_subcontractor_performance                                │
├─────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                          │
│ vendor_id         UUID → v2_vendors                         │
│ scope_category_id UUID → v2_scope_categories                │
│ job_count         INTEGER                                   │
│ avg_days_per_unit DECIMAL(8,4)                              │
│ avg_quality_score DECIMAL(3,2)                              │
│ on_time_percent   DECIMAL(5,2)                              │
│ updated_at        TIMESTAMPTZ                               │
└─────────────────────────────────────────────────────────────┘
```

---

# PART 6: FILE STRUCTURE

```
Construction-Management-Software/
│
├── .env                          # Server environment variables
├── .mcp.json                     # MCP server config (Supabase + Chrome)
├── CLAUDE.md                     # Development documentation
├── package.json                  # Dependencies and scripts
│
├── server/
│   ├── index.js                  # Express entry, route mounting
│   ├── app.js                    # Express configuration
│   │
│   ├── routes/                   # API endpoints (60+ files)
│   │   ├── invoices.js
│   │   ├── purchase-orders.js
│   │   ├── draws.js
│   │   ├── bids.js
│   │   ├── jobs.js
│   │   ├── daily-logs.js
│   │   ├── vendors.js
│   │   ├── scope-categories.js
│   │   └── ...
│   │
│   ├── ai/                       # AI processing
│   │   ├── processor.js          # Invoice AI extraction
│   │   ├── ocr-processor.js      # Scanned PDF OCR
│   │   └── document-processor.js
│   │
│   ├── documents/                # PDF handling
│   │   ├── pdf-stamper.js        # Approval stamps
│   │   └── converter.js
│   │
│   ├── core/                     # Infrastructure
│   │   ├── errors.js
│   │   ├── locking.js            # 5-min edit locks
│   │   ├── undo.js               # 30-sec undo
│   │   └── realtime.js           # SSE events
│   │
│   └── services/                 # Business logic
│       ├── standards.js          # Naming conventions
│       └── reconciliation.js
│
├── client/
│   ├── .env                      # Client environment
│   ├── index.html
│   │
│   └── src/
│       ├── App.tsx               # Router setup
│       ├── main.tsx              # Entry point
│       │
│       ├── pages/                # Route pages
│       │   ├── Dashboard.tsx
│       │   ├── Invoices.tsx
│       │   ├── PurchaseOrders.tsx
│       │   ├── Draws.tsx
│       │   ├── Bids.tsx
│       │   ├── Jobs.tsx
│       │   ├── DailyLogs.tsx
│       │   ├── Vendors.tsx
│       │   └── ...
│       │
│       ├── components/           # UI components
│       │   ├── layout/
│       │   │   └── Sidebar.tsx   # Navigation
│       │   │
│       │   ├── invoices/
│       │   │   ├── InvoiceUploadDialog.tsx
│       │   │   ├── InvoiceDetailDialog.tsx
│       │   │   └── AIProcessingAnimation.tsx
│       │   │
│       │   ├── purchase-orders/
│       │   │   ├── POFormDialog.tsx
│       │   │   └── PODetailDialog.tsx
│       │   │
│       │   ├── draws/
│       │   │   ├── DrawDetailDialog.tsx
│       │   │   ├── G702Tab.tsx
│       │   │   └── G703Tab.tsx
│       │   │
│       │   ├── bids/
│       │   │   ├── BidPackageFormDialog.tsx
│       │   │   ├── BidPackageDetailDialog.tsx
│       │   │   ├── BidComparisonView.tsx
│       │   │   └── SubcontractorBidFormDialog.tsx
│       │   │
│       │   ├── daily-logs/
│       │   │   ├── DailyLogFormDialog.tsx
│       │   │   └── DailyLogDetailDialog.tsx
│       │   │
│       │   └── ui/               # Shared components
│       │       ├── Button.tsx
│       │       ├── Dialog.tsx
│       │       ├── Input.tsx
│       │       └── ...
│       │
│       └── hooks/                # Data fetching
│           ├── useInvoices.ts
│           ├── usePurchaseOrders.ts
│           ├── useDraws.ts
│           ├── useBidPackages.ts
│           ├── useDailyLogs.ts
│           ├── useScopeTracking.ts
│           ├── useJobs.ts
│           └── useVendors.ts
│
├── database/
│   ├── schema.sql                # Base schema
│   └── migration-*.sql           # 130+ migrations
│
└── tests/
    └── *.spec.js                 # Playwright E2E tests
```

---

# PART 7: QUICK REFERENCE

## Start the App
```bash
cd "C:\Users\jaker\Construction-Management-Software"
npm start
# Opens at http://localhost:3001
```

## Key URLs
| Resource | URL |
|----------|-----|
| App | http://localhost:3001 |
| API | http://localhost:3001/api/* |
| Supabase | https://sorghqcpeamdfbvysafj.supabase.co |

## Status Badges Color Coding
| Color | Meaning |
|-------|---------|
| 🟡 Yellow/Orange | Draft, Pending, Needs Review |
| 🟢 Green | Approved, Active, Completed |
| 🔵 Blue | Submitted, In Progress |
| 🔴 Red | Denied, Cancelled, Overdue |

## Common Workflows

**Process an invoice:**
Invoices → Upload → AI processes → Review → Approve

**Create a draw:**
Draws → New → Select job → Add invoices → Export G702/G703

**Track a PO:**
POs → Select PO → View invoices → Check progress bar

**Log daily work:**
Daily Logs → New → Add crew → Track performance → Save
