# Ross Built Construction Management Software

## Overview
Simplified invoice approval and AR pipeline system for Ross Built Custom Homes. Focuses on the core workflow: Invoice → AI Processing → Approval → Draw → Payment.

**Server**: http://localhost:3001

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Supabase Storage (PDFs)
- **Frontend**: Vanilla JS (no framework)
- **AI Processing**: Claude Sonnet (Anthropic API)
- **PDF Stamping**: pdf-lib
- **Excel Export**: ExcelJS

---

## Quick Start

```bash
# Start server
npm start

# Start with migrations (recommended)
npm run db:start

# Development
npm run dev

# Server runs on http://localhost:3001
```

---

## Database Migrations

Automated migration system using Supabase Management API.

```bash
# Check migration status
npm run migrate:status

# Run pending migrations
npm run migrate

# Force re-run all migrations
npm run migrate:force

# Start server with migrations
npm run db:start
```

Migration files are in `database/migration-*.sql`. The system tracks applied migrations in the `schema_migrations` table.

**Environment Required:**
- `SUPABASE_ACCESS_TOKEN` - Get from https://supabase.com/dashboard/account/tokens

---

## File Structure

```
Construction-Management-Software/
├── config/
│   └── index.js              # Supabase client, port config
├── server/
│   ├── index.js              # Express server, all API endpoints
│   ├── ai-processor.js       # AI invoice extraction & matching
│   ├── ai-learning.js        # AI learning from corrections
│   ├── ocr-processor.js      # OCR for scanned PDFs (Claude Vision)
│   ├── document-converter.js # PDF to image conversion
│   ├── duplicate-check.js    # Duplicate invoice detection
│   ├── standards.js          # Naming conventions, normalization
│   ├── storage.js            # Supabase storage helpers
│   ├── pdf-stamper.js        # PDF approval stamping
│   ├── validation.js         # Invoice/PO validation rules
│   ├── errors.js             # AppError class, error codes
│   ├── locking.js            # Entity locking system (5-min locks)
│   ├── undo.js               # Undo system (30-sec window)
│   ├── realtime.js           # SSE handler, Supabase realtime
│   └── migrate.js            # Database migration runner
├── public/
│   ├── index.html            # Invoice approval dashboard (main page)
│   ├── draws.html            # Draws management (G702/G703 Pay Applications)
│   ├── pos.html              # Purchase Orders management
│   ├── css/
│   │   └── styles.css        # Dark theme styling (~7200 lines)
│   └── js/
│       ├── modals.js         # Invoice edit modal, job selection, add to draw
│       ├── po-modals.js      # PO detail modal, create/edit PO
│       ├── toasts.js         # Toast notification system
│       └── realtime.js       # SSE client, offline queue
├── database/
│   ├── schema.sql            # Base schema (v2_ tables)
│   ├── migration-001-*.sql   # PO and enhanced invoices
│   ├── migration-002-*.sql   # Invoice system enhancements
│   ├── migration-003-*.sql   # Allocation job_id
│   ├── migration-004-*.sql   # Payment tracking
│   └── migration-005-*.sql   # PO enhancements (change orders, attachments)
├── tests/
│   └── *.spec.js             # Playwright E2E tests
├── package.json
├── .env                      # Environment variables
└── CLAUDE.md                 # This file
```

---

## Pages & Features

### 1. Invoice Dashboard (`index.html`)
Main invoice management page with:
- **Filter dropdowns**: Status (All Active, Needs Approval, Approved, In Draw, New, Archive), Job filter
- **Invoice list**: Shows vendor, invoice #, date, amount, status badge
- **Invoice modal**: Full details, allocations, approval actions
- **AI Processing**: Upload PDF → AI extracts data → auto-matches job/vendor/PO
- **Bulk actions**: Approve multiple, add to draw, deny

### 2. Draws Page (`draws.html`)
AIA G702/G703 Pay Application management:
- **Draw list**: Shows all draws with job, status, amount
- **Draw modal** (fullscreen with tabs):
  - **Summary tab**: Job, Application #, Period, Invoice count, This Period, Payment Due
  - **G702 tab**: AIA Document G702 - Application and Certificate for Payment
  - **G703 tab**: Schedule of Values - Budget vs Billings per cost code
    - Columns: #, Cost Code, Budget, Previous Billings, Current Billings, Total Billed, % Complete, Balance Remaining, Retainage
  - **Invoices tab**: List of invoices in draw with Add/Remove
- **Export**: Excel and PDF export buttons
- **Create Draw**: Modal to create new draw for a job

### 3. Purchase Orders Page (`pos.html`)
PO management with:
- **Filter dropdowns**: Status, Job filter
- **PO list**: Shows PO#, job, vendor, amount, status
- **PO modal** (fullscreen):
  - Header with PO#, job, vendor, status badges
  - **Overview tab**: Totals, dates, progress bar
  - **Line Items tab**: Cost code breakdown
  - **Invoices tab**: Linked invoices
  - **Activity tab**: PO history/audit log
  - **Change Orders tab**: Track CO's
- **Create PO**: Modal with line items

---

## Database Schema (v2_ prefix)

### Core Tables

#### v2_jobs
```sql
id UUID PRIMARY KEY
name TEXT                    -- "Drummond-501 74th St"
address TEXT
client_name TEXT
contract_amount DECIMAL(12,2)
status TEXT                  -- active, completed, on_hold
created_at TIMESTAMPTZ
```

#### v2_vendors
```sql
id UUID PRIMARY KEY
name TEXT
email TEXT
phone TEXT
created_at TIMESTAMPTZ
```

#### v2_cost_codes
```sql
id UUID PRIMARY KEY
code TEXT                    -- "06100"
name TEXT                    -- "Rough Carpentry"
category TEXT
```

#### v2_invoices
```sql
id UUID PRIMARY KEY
job_id UUID REFERENCES v2_jobs
vendor_id UUID REFERENCES v2_vendors
po_id UUID REFERENCES v2_purchase_orders
invoice_number TEXT
invoice_date DATE
due_date DATE
amount DECIMAL(12,2)
status TEXT                  -- received, needs_approval, approved, in_draw, paid
pdf_url TEXT
pdf_stamped_url TEXT
ai_processed BOOLEAN
ai_confidence JSONB
ai_extracted_data JSONB
needs_review BOOLEAN
review_flags TEXT[]
version INTEGER
deleted_at TIMESTAMPTZ
approved_at TIMESTAMPTZ
approved_by TEXT
notes TEXT
created_at TIMESTAMPTZ
```

#### v2_invoice_allocations
```sql
id UUID PRIMARY KEY
invoice_id UUID REFERENCES v2_invoices
job_id UUID REFERENCES v2_jobs
cost_code_id UUID REFERENCES v2_cost_codes
amount DECIMAL(12,2)
notes TEXT
```

#### v2_purchase_orders
```sql
id UUID PRIMARY KEY
job_id UUID REFERENCES v2_jobs
vendor_id UUID REFERENCES v2_vendors
po_number TEXT               -- "PO-Drummond501-0001"
description TEXT
total_amount DECIMAL(12,2)
status TEXT                  -- open, closed, cancelled
status_detail TEXT           -- pending, approved, active, closed, cancelled
approval_status TEXT         -- pending, approved, rejected
approved_at TIMESTAMPTZ
approved_by TEXT
original_amount DECIMAL(12,2)
change_order_total DECIMAL(12,2)
scope_of_work TEXT
notes TEXT
version INTEGER
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
deleted_at TIMESTAMPTZ
```

#### v2_po_line_items
```sql
id UUID PRIMARY KEY
po_id UUID REFERENCES v2_purchase_orders
cost_code_id UUID REFERENCES v2_cost_codes
description TEXT
amount DECIMAL(12,2)
invoiced_amount DECIMAL(12,2)  -- Tracks billing against line
```

#### v2_draws
```sql
id UUID PRIMARY KEY
job_id UUID REFERENCES v2_jobs
draw_number INTEGER
period_end DATE
total_amount DECIMAL(12,2)
status TEXT                  -- draft, submitted, funded
submitted_at TIMESTAMPTZ
funded_at TIMESTAMPTZ
funded_amount DECIMAL(12,2)
created_at TIMESTAMPTZ
UNIQUE(job_id, draw_number)
```

#### v2_draw_invoices
```sql
id UUID PRIMARY KEY
draw_id UUID REFERENCES v2_draws
invoice_id UUID REFERENCES v2_invoices
UNIQUE(draw_id, invoice_id)
```

#### v2_budget_lines
```sql
id UUID PRIMARY KEY
job_id UUID REFERENCES v2_jobs
cost_code_id UUID REFERENCES v2_cost_codes
budgeted_amount DECIMAL(12,2)
committed_amount DECIMAL(12,2)
billed_amount DECIMAL(12,2)
paid_amount DECIMAL(12,2)
UNIQUE(job_id, cost_code_id)
```

### Supporting Tables

- **v2_change_orders**: PO change orders with line items
- **v2_po_attachments**: Files attached to POs
- **v2_po_activity**: PO audit log
- **v2_invoice_activity**: Invoice audit log
- **v2_entity_locks**: Edit locking (5-min)
- **v2_undo_queue**: Undo snapshots (30-sec)
- **v2_invoice_hashes**: Duplicate detection
- **v2_approval_thresholds**: Auto-approval rules

---

## Key API Endpoints

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List with filters |
| GET | `/api/invoices/:id` | Get with details |
| POST | `/api/invoices/process` | AI processing (supports OCR) |
| PATCH | `/api/invoices/:id/approve` | Approve + stamp PDF |
| POST | `/api/invoices/:id/allocate` | Set allocations |
| POST | `/api/invoices/:id/transition` | Status change |
| POST | `/api/invoices/:id/split` | Split into children |
| GET | `/api/invoices/:id/family` | Get parent + children |

### AI & Learning
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/stats` | AI learning statistics |
| GET | `/api/vendors/duplicates` | Potential duplicate vendors |

### Purchase Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase-orders` | List with filters |
| GET | `/api/purchase-orders/:id` | Get with line items |
| POST | `/api/purchase-orders` | Create PO |
| PATCH | `/api/purchase-orders/:id` | Update PO |
| POST | `/api/purchase-orders/:id/approve` | Approve PO |
| GET | `/api/pos/stats` | PO statistics |

### Draws
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/draws` | List all draws |
| GET | `/api/draws/:id` | Get with G702/G703 data |
| POST | `/api/jobs/:id/draws` | Create draw |
| POST | `/api/draws/:id/add-invoices` | Add invoices |
| POST | `/api/draws/:id/remove-invoice` | Remove invoice |
| PATCH | `/api/draws/:id/submit` | Submit draw |
| PATCH | `/api/draws/:id/fund` | Mark funded |
| GET | `/api/draws/:id/export/excel` | Excel export |
| GET | `/api/draws/:id/export/pdf` | PDF export |

### Budget & Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List jobs |
| GET | `/api/jobs/:id/budget` | Budget with actuals |
| GET | `/api/dashboard/stats` | Dashboard metrics |

---

## Invoice Status Flow

```
Upload PDF → AI Processing → [received]
                                ↓
                        Review → [needs_approval]
                                ↓
                     PM Approves → [approved] → PDF Stamped
                                ↓
                    Add to Draw → [in_draw]
                                ↓
                   Client Pays → [paid] → Archived
```

**Valid Transitions**:
- received → needs_approval, denied
- needs_approval → approved, denied, received
- approved → in_draw, needs_approval
- in_draw → paid, approved
- paid → (terminal)

---

## G702/G703 Calculations

### G702 (Application and Certificate for Payment)
```javascript
{
  originalContractSum: job.contract_amount,
  netChangeOrders: 0,
  contractSumToDate: originalContractSum + netChangeOrders,
  totalCompletedToDate: sum(all invoice amounts in previous + current draws),
  totalCompletedThisPeriod: sum(current draw invoice amounts),
  retainagePercent: 10,
  retainageAmount: totalCompletedToDate * 0.10,
  lessPreviousCertificates: sum(previous draws),
  currentPaymentDue: totalCompletedThisPeriod - (retainageThisPeriod)
}
```

### G703 (Schedule of Values)
Per cost code:
```javascript
{
  costCode: "06100 - Rough Carpentry",
  scheduledValue: budgeted_amount,
  previousBillings: sum(allocations from previous draws),
  currentBillings: sum(allocations from this draw),
  totalBilled: previous + current,
  percentComplete: (totalBilled / scheduledValue) * 100,
  balanceRemaining: scheduledValue - totalBilled,
  retainage: totalBilled * 0.10
}
```

---

## PDF Stamp Format

When invoice is approved, stamp added to top-right corner:

```
┌──────────────────────────────────┐
│ APPROVED                         │
│ Date: 1/7/2026                   │
│ By: Jake Ross                    │
│ Job: Drummond-501 74th St        │
│ Amount: $17,760.00               │
│ --- Cost Codes ---               │
│ 06100 Rough Carpentry ($17,760)  │
│ --- Purchase Order ---           │
│ PO: PO-Drummond501-0001          │
│ PO Total: $25,000.00             │
│ Billed: $17,760.00 (71%)         │
│ Remaining: $7,240.00             │
└──────────────────────────────────┘
```

---

## Naming Conventions

### Invoice Files
Format: `INV_{Job}_{Vendor}_{Date}.pdf`
Example: `INV_Drummond_FloridaSunshineCarpentry_2025-01-06.pdf`

### PO Numbers
Format: `PO-{JobIdentifier}-{XXXX}`
Example: `PO-Drummond501-0043`

### Job Identifiers
Derived from job name: Client + Street Number
- "Drummond-501 74th St" → `Drummond501`
- "Crews-8290 Manasota Key" → `Crews8290`

---

## Environment Variables

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
ANTHROPIC_API_KEY=sk-ant-api03-...
PORT=3001
```

---

## CSS Theming

Dark theme with CSS variables:
```css
:root {
  --bg-primary: #0d1117;
  --bg-card: #161b22;
  --bg-card-elevated: #1c2128;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --accent-blue: #58a6ff;
  --accent-green: #3fb950;
  --accent-orange: #d29922;
  --accent-red: #f85149;
  --border: #30363d;
}
```

Status badge colors:
- Draft/Pending: `--accent-orange`
- Approved/Active: `--accent-green`
- Submitted/In Progress: `--accent-blue`
- Denied/Cancelled: `--accent-red`

---

## Recent Changes (Jan 2026)

### OCR, AI Learning, and Bug Fixes (Jan 15)
- **OCR Processing**: Scanned PDFs now auto-detected and processed via Claude Vision
- **AI Learning System**: Records corrections to improve future matching (90%+ confidence)
- **Split Invoice Feature**: Divide one invoice into multiple children for different jobs/POs
- **Credit Invoice Support**: Negative amounts for returns/credits properly tracked in draws
- **CO Link Prompt**: Approval flow prompts to link CO allocations to Change Orders
- **Bug Fixes**:
  - Fixed draw activity endpoint (deleted_at column)
  - Fixed invoice removal from draw on status change
  - Fixed billed_amount exceeding invoice amount
  - Fixed 404 handling for non-existent invoices
  - Added double-click protection on CO creation
  - CO deletion now allowed for COs with no linked invoices

### Draw Modal with G702/G703 (Jan 7)
- Added fullscreen draw modal with 4 tabs
- G702: AIA payment application format
- G703: Schedule of Values with budget vs billings
- Excel/PDF export functionality
- Add to Draw flow from approved invoices
- Fixed modal CSS opacity issues

### PO Management System (Jan 7)
- Fullscreen PO detail modal
- Line items with cost code allocation
- Change order tracking
- PO approval workflow
- Activity/audit log
- Filter dropdowns (status, job)

### Invoice Enhancements (Jan 6)
- AI confidence scoring
- Entity locking (5-min)
- Undo system (30-sec)
- Realtime sync via SSE
- PDF stamping with PO info
- Bulk operations

---

## Known Patterns

### Modal Pattern (CRITICAL)
Fullscreen modals use class `modal-fullscreen-dark`:
```html
<div id="myModal" class="modal modal-fullscreen-dark">
  <div class="modal-content">
    <div class="modal-header">...</div>
    <div class="modal-body">...</div>
    <div class="modal-footer">...</div>
  </div>
</div>
```

**IMPORTANT**: CSS uses `opacity: 0` by default. You MUST add `.show` class for visibility:
```javascript
// OPEN MODAL - must add .show class or modal will be invisible!
function openModal() {
  const modal = document.getElementById('myModal');
  modal.style.display = 'flex';
  modal.classList.add('show');  // REQUIRED for opacity transition
}

// CLOSE MODAL - remove .show before hiding
function closeModal() {
  const modal = document.getElementById('myModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}
```

### Page Initialization Pattern (CRITICAL)
Always set up UI controls BEFORE loading data. Wrap async loads individually:
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Set up UI controls FIRST - page stays responsive even if data fails
  setupEventListeners();
  setupFilters();

  // 2. Load data with individual error handling
  try {
    await Promise.all([
      loadJobs().catch(err => console.error('Jobs failed:', err)),
      loadVendors().catch(err => console.error('Vendors failed:', err))
    ]);
  } catch (err) {
    showToast('Some data failed to load', 'error');
  }

  // 3. Then load main content
  await loadMainData();
});
```

### Tab Pattern
```html
<div class="tabs">
  <button class="tab active" data-tab="summary">Summary</button>
  <button class="tab" data-tab="details">Details</button>
</div>
<div id="tab-summary" class="tab-content active">...</div>
<div id="tab-details" class="tab-content">...</div>
```

### Toast Pattern
```javascript
showToast('Invoice approved', 'success');
showToast('Error occurred', 'error');
```

### Filter Dropdown Pattern
```html
<select id="statusFilter" onchange="applyFilters()">
  <option value="all">All Active</option>
  <option value="approved">Approved</option>
</select>
```

### Input Debouncing Pattern
Always debounce search/filter inputs to prevent DOM thrashing:
```javascript
let debounceTimer;
input.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    handleSearch(e.target.value);
  }, 150);  // 150ms delay
});
```

### API Caching Pattern
Use `window.APICache` for reference data (jobs, vendors, cost codes):
```javascript
// Cached fetch with 5-min TTL (falls back to regular fetch if cache unavailable)
const jobs = await window.APICache?.fetch('/api/jobs')
  || await fetch('/api/jobs').then(r => r.json());
```

### Parallel Data Loading
Use Promise.all for independent API calls (avoid N+1 problem):
```javascript
// BAD - sequential (slow)
for (const po of pos) {
  po.billed = await getBilled(po.id);
}

// GOOD - parallel (fast)
const billedAmounts = await Promise.all(pos.map(po => getBilled(po.id)));
pos.forEach((po, i) => po.billed = billedAmounts[i]);
```

---

## Troubleshooting

### Modal not visible / Page frozen on button click
The modal `.show` class is missing. CSS uses `opacity: 0` by default.
Fix: Add `modal.classList.add('show')` after setting `display: flex`

### API 404
Check route order in server/index.js - specific routes before parameterized routes

### Budget not updating
Check allocations have `job_id` set (migration-003)

### Server restart
```bash
# SAFE restart (uses PID file - won't kill other node processes like Claude)
npm run restart

# Or manually:
npm run stop    # Stops only the server
npm start       # Start fresh

# The server writes its PID to server.pid on startup
# npm run stop reads this file and kills only that process
```
