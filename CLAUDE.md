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

---

## Features

### 1. AI Invoice Processing
When an invoice PDF is uploaded:
- Extracts text from PDF using `pdf-parse`
- Claude AI extracts structured data:
  - Vendor name, trade type, contact info
  - Invoice number, date, amounts
  - Job address for matching
  - Line items with quantities/amounts
- Auto-matches to existing job by address
- Auto-matches or creates new vendor
- Auto-matches or creates draft PO
- Renames file with standardized convention
- Uploads to Supabase storage in job folder

### 2. Invoice Approval Workflow
```
Upload PDF → AI Processing → [received]
                                ↓
                           PM Codes → [coded]
                                ↓
                        PM Approves → [approved] → PDF Stamped
                                ↓
                      Add to Draw → [in_draw]
                                ↓
                      Client Pays → [paid] → Archived
```

### 3. PDF Stamping
When invoice is approved, stamp is added to the top-right corner of the first page:

```
┌──────────────────────────────────┐
│ APPROVED                         │
│ Date: 1/6/2026                   │
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

Includes:
- APPROVED status (green header)
- Approval date and approver name
- Job name
- Invoice amount
- Cost codes with individual amounts
- PO details (if linked):
  - PO number
  - PO total amount
  - Amount billed to date (including this invoice)
  - Percentage of PO billed
  - Remaining PO balance

### 4. Filter System
- **All Active**: Everything except paid
- **Needs Approval**: Status = coded
- **Approved**: Ready for draw
- **In Draw**: Waiting on client funding
- **New**: Just received
- **Archive**: Paid/completed

---

## File Structure

```
P:\Ross Built Construction Management Software\
├── config/
│   └── index.js              # Supabase client, port config
├── server/
│   ├── index.js              # Express server, all API endpoints
│   ├── ai-processor.js       # AI invoice extraction & matching (w/ confidence scoring)
│   ├── standards.js          # Naming conventions, normalization
│   ├── storage.js            # Supabase storage helpers
│   ├── pdf-stamper.js        # PDF approval stamping
│   ├── validation.js         # Invoice validation rules, status transitions
│   ├── errors.js             # AppError class, error codes with retry info
│   ├── locking.js            # Entity locking system (5-min locks)
│   ├── undo.js               # Undo system (30-sec window)
│   └── realtime.js           # SSE handler, Supabase realtime subscriptions
├── public/
│   ├── index.html            # Invoice approval dashboard
│   ├── css/
│   │   └── styles.css        # Dark theme styling (incl. toasts, modals)
│   └── js/
│       ├── app.js            # Frontend logic
│       ├── toasts.js         # Toast notification system (with undo support)
│       ├── realtime.js       # SSE client, offline queue management
│       ├── validation.js     # Frontend validation (mirrors server rules)
│       └── modals.js         # Edit modal, job selection modal
├── database/
│   └── migration-002-invoice-system-enhancements.sql  # Soft delete, undo, locks, AI metadata
├── package.json
├── .env                      # Environment variables
└── CLAUDE.md                 # This file
```

---

## API Endpoints

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Owner dashboard statistics |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List all jobs |
| GET | `/api/jobs/:id` | Get single job |

### Vendors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List all vendors |
| POST | `/api/vendors` | Create new vendor |

### Cost Codes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cost-codes` | List all cost codes |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List invoices (with filters) |
| GET | `/api/invoices/:id` | Get invoice with details |
| GET | `/api/invoices/:id/activity` | Get invoice activity log |
| GET | `/api/invoices/:id/allocations` | Get invoice allocations |
| GET | `/api/invoices/:id/version` | Get version for conflict detection |
| GET | `/api/invoices/needs-review` | Get invoices flagged for review |
| GET | `/api/invoices/low-confidence` | Get low AI confidence invoices |
| GET | `/api/invoices/no-job` | Get invoices without job assignment |
| POST | `/api/invoices/upload` | Basic upload (manual entry) |
| POST | `/api/invoices/process` | **AI-powered processing** |
| PATCH | `/api/invoices/:id` | Partial update (with lock check) |
| PUT | `/api/invoices/:id/full` | Full update (with lock check) |
| POST | `/api/invoices/:id/transition` | Status transition (with validation) |
| PATCH | `/api/invoices/:id/code` | Code invoice (legacy) |
| PATCH | `/api/invoices/:id/approve` | Approve + stamp PDF |
| PATCH | `/api/invoices/:id/deny` | Deny with reason |
| PATCH | `/api/invoices/:id/override` | Override AI-extracted field |
| POST | `/api/invoices/:id/allocate` | Allocate to cost codes |
| POST | `/api/invoices/:id/undo` | Undo last action |
| DELETE | `/api/invoices/:id` | Soft delete invoice |

### Bulk Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoices/bulk/approve` | Approve multiple invoices |
| POST | `/api/invoices/bulk/add-to-draw` | Add multiple to draw |
| POST | `/api/invoices/bulk/deny` | Deny multiple invoices |

### Locking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/locks/acquire` | Acquire entity lock |
| DELETE | `/api/locks/:lockId` | Release lock |
| GET | `/api/locks/check/:entityType/:entityId` | Check lock status |

### Undo
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/undo/available/:entityType/:entityId` | Check for available undo |
| POST | `/api/invoices/:id/undo` | Execute undo operation |

### Realtime
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/realtime/events` | SSE connection for live updates |
| GET | `/api/realtime/stats` | Get connection stats |

### Purchase Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase-orders` | List POs (with filters) |
| GET | `/api/purchase-orders/:id` | Get PO with line items |
| POST | `/api/purchase-orders` | Create PO |

### Draws
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/:id/draws` | List draws for job |
| POST | `/api/jobs/:id/draws` | Create new draw |
| POST | `/api/draws/:id/add-invoices` | Add invoices to draw |
| PATCH | `/api/draws/:id/submit` | Submit draw |
| PATCH | `/api/draws/:id/fund` | Mark draw as funded |

### Budget
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/:id/budget` | Get budget lines with actuals |
| GET | `/api/jobs/:id/stats` | Get job-specific invoice/draw stats |

---

## Database Schema (v2_ prefix)

### v2_jobs
```sql
id UUID PRIMARY KEY
name TEXT                    -- "Drummond-501 74th St"
address TEXT
client_name TEXT
contract_amount DECIMAL
status TEXT                  -- active, completed, on_hold
created_at TIMESTAMPTZ
```

### v2_vendors
```sql
id UUID PRIMARY KEY
name TEXT
email TEXT
phone TEXT
created_at TIMESTAMPTZ
```

### v2_cost_codes
```sql
id UUID PRIMARY KEY
code TEXT                    -- "06100"
name TEXT                    -- "Rough Carpentry"
category TEXT
```

### v2_invoices
```sql
id UUID PRIMARY KEY
job_id UUID REFERENCES v2_jobs
vendor_id UUID REFERENCES v2_vendors
po_id UUID REFERENCES v2_purchase_orders
invoice_number TEXT
invoice_date DATE
due_date DATE
amount DECIMAL
status TEXT                  -- received, coded, approved, in_draw, paid
pdf_url TEXT                 -- Original PDF
pdf_stamped_url TEXT         -- Stamped PDF

-- AI Processing Metadata
ai_processed BOOLEAN         -- Has been AI-processed
ai_confidence JSONB          -- Per-field confidence scores
ai_extracted_data JSONB      -- Original AI extraction
ai_overrides JSONB           -- Manual field overrides
needs_review BOOLEAN         -- Flagged for human review
review_flags TEXT[]          -- Reasons for review

-- Versioning
version INTEGER              -- For conflict detection
deleted_at TIMESTAMPTZ       -- Soft delete timestamp

-- Audit Trail
coded_at TIMESTAMPTZ
coded_by TEXT
approved_at TIMESTAMPTZ
approved_by TEXT
denied_at TIMESTAMPTZ
denied_by TEXT
denial_reason TEXT
notes TEXT
created_at TIMESTAMPTZ
```

### v2_undo_queue
```sql
id UUID PRIMARY KEY
entity_type TEXT             -- 'invoice', 'allocation'
entity_id UUID
action TEXT                  -- 'approved', 'edited', 'deleted'
previous_state JSONB         -- State before change
performed_by TEXT
expires_at TIMESTAMPTZ       -- 30-second window
undone BOOLEAN               -- Whether undo was executed
created_at TIMESTAMPTZ
```

### v2_entity_locks
```sql
id UUID PRIMARY KEY
entity_type TEXT             -- 'invoice', 'draw'
entity_id UUID
locked_by TEXT
locked_at TIMESTAMPTZ
expires_at TIMESTAMPTZ       -- 5-minute lock duration
UNIQUE(entity_type, entity_id)
```

### v2_invoice_hashes
```sql
id UUID PRIMARY KEY
file_hash TEXT UNIQUE        -- SHA-256 of PDF content
invoice_id UUID REFERENCES v2_invoices
created_at TIMESTAMPTZ
```

### v2_file_references
```sql
id UUID PRIMARY KEY
invoice_id UUID REFERENCES v2_invoices
file_type TEXT               -- 'original', 'stamped'
storage_path TEXT
file_size BIGINT
created_at TIMESTAMPTZ
```

### v2_invoice_allocations
```sql
id UUID PRIMARY KEY
invoice_id UUID REFERENCES v2_invoices
cost_code_id UUID REFERENCES v2_cost_codes
amount DECIMAL
notes TEXT
```

### v2_invoice_activity
```sql
id UUID PRIMARY KEY
invoice_id UUID REFERENCES v2_invoices
action TEXT                  -- uploaded, coded, approved, denied, added_to_draw, paid
performed_by TEXT
details JSONB
created_at TIMESTAMPTZ
```

### v2_purchase_orders
```sql
id UUID PRIMARY KEY
job_id UUID REFERENCES v2_jobs
vendor_id UUID REFERENCES v2_vendors
po_number TEXT               -- "PO-Drummond501-0001"
description TEXT
total_amount DECIMAL
status TEXT                  -- open, closed, cancelled
created_at TIMESTAMPTZ
created_by TEXT
```

### v2_po_line_items
```sql
id UUID PRIMARY KEY
po_id UUID REFERENCES v2_purchase_orders
cost_code_id UUID REFERENCES v2_cost_codes
description TEXT
amount DECIMAL
invoiced_amount DECIMAL      -- Tracks how much billed against this line
```

### v2_budget_lines
```sql
id UUID PRIMARY KEY
job_id UUID REFERENCES v2_jobs
cost_code_id UUID REFERENCES v2_cost_codes
budgeted_amount DECIMAL
committed_amount DECIMAL
```

### v2_draws
```sql
id UUID PRIMARY KEY
job_id UUID REFERENCES v2_jobs
draw_number INTEGER
period_end DATE
total_amount DECIMAL
status TEXT                  -- draft, submitted, funded
submitted_at TIMESTAMPTZ
funded_at TIMESTAMPTZ
funded_amount DECIMAL
```

### v2_draw_invoices
```sql
id UUID PRIMARY KEY
draw_id UUID REFERENCES v2_draws
invoice_id UUID REFERENCES v2_invoices
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
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Server
PORT=3001

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## Commands

```bash
# Start server
npm start

# Development
npm run dev

# Install dependencies
npm install
```

---

## Pending Features

- [x] Wire up live budget updates (update budget when invoice approved) - DONE
- [x] AI confidence scoring system - DONE
- [x] Edit locking and undo system - DONE
- [x] Realtime sync via SSE - DONE
- [x] Status transition validation - DONE
- [ ] Email intake (Power Automate integration)
- [ ] QuickBooks sync
- [ ] Lien waiver tracking
- [ ] Multi-job invoice splitting

---

## AI Confidence Scoring

When AI processes an invoice, it returns confidence scores for each extracted field:

### Confidence Thresholds
| Level | Score | Behavior |
|-------|-------|----------|
| HIGH | ≥ 90% | Auto-assign, no review needed |
| MEDIUM | 60-90% | Auto-assign but flag for review |
| LOW | < 60% | Don't auto-assign, show picker |

### Confidence Fields
```javascript
{
  job: 0.95,           // Job match confidence
  vendor: 0.85,        // Vendor match confidence
  amount: 0.98,        // Amount extraction confidence
  invoice_number: 0.92 // Invoice number confidence
}
```

### Review Flags
Invoices are flagged for review when:
- Any field has LOW confidence
- No job match found
- Potential duplicate detected
- Amount seems unusually high/low

---

## Status Transitions

### Valid Transitions
```
received → coded, denied, deleted
coded → approved, denied, received (recall)
approved → in_draw, coded (recall)
in_draw → paid, approved (recall)
denied → received
paid → (terminal state)
```

### Pre-Transition Requirements
| Target Status | Requirements |
|---------------|--------------|
| coded | job_id, vendor_id assigned |
| approved | job_id, vendor_id, balanced allocations |
| in_draw | Must select draw to add to |
| paid | Draw must be funded |

---

## Entity Locking

Prevents concurrent edits on invoices:

- **Lock Duration**: 5 minutes
- **Auto-refresh**: Locks can be renewed by the same user
- **Force Release**: Admins can force-release stale locks
- **Cleanup**: Expired locks are automatically cleaned up

### Lock API
```javascript
// Acquire lock
POST /api/locks/acquire
{ entity_type: 'invoice', entity_id: 'uuid', locked_by: 'user' }

// Release lock
DELETE /api/locks/:lockId

// Check lock
GET /api/locks/check/invoice/:invoiceId
```

---

## Undo System

Provides timed undo capability for invoice operations:

- **Undo Window**: 30 seconds after action
- **Supported Actions**: approve, edit, delete, allocate
- **Side Effect Reversal**: Automatically reverses budget updates, PO updates

### Undo Flow
1. Action creates undo snapshot with previous state
2. User sees toast with Undo button
3. If clicked within 30s, previous state is restored
4. Budget/PO changes are automatically reversed

---

## Realtime Sync (SSE)

Frontend maintains persistent SSE connection for live updates:

### Events
| Event | Description |
|-------|-------------|
| `connected` | Initial connection established |
| `ping` | Heartbeat (every 30s) |
| `invoice_change` | Invoice created/updated/deleted |
| `invoice_update` | Invoice action performed |
| `activity_log` | New activity logged |
| `draw_change` | Draw modified |
| `lock_change` | Lock acquired/released |
| `notification` | Toast notification from server |

### Frontend Usage
```javascript
// Listen for invoice updates
window.realtimeSync.on('invoice_update', (data) => {
  refreshInvoiceList();
});

// Check connection state
window.realtimeSync.getState();
// { connectionState: 'connected', clientId: '...', isOnline: true }
```

---

## Error Handling

Structured errors with retry information:

### Error Response Format
```javascript
{
  success: false,
  error: {
    code: 'ENTITY_LOCKED',
    message: 'Invoice is being edited by another user',
    status: 409,
    retry: true,
    retryAfter: 5000,
    details: { lockedBy: 'Jake Ross', expiresAt: '...' }
  }
}
```

### Error Codes
| Code | Status | Retry | Description |
|------|--------|-------|-------------|
| VALIDATION_FAILED | 400 | No | Invalid field values |
| TRANSITION_NOT_ALLOWED | 400 | No | Invalid status change |
| PRE_TRANSITION_FAILED | 400 | No | Requirements not met |
| DUPLICATE_DETECTED | 409 | No | Similar invoice exists |
| ENTITY_LOCKED | 409 | Yes | Being edited by another |
| VERSION_CONFLICT | 409 | No | Data changed since load |
| UNDO_EXPIRED | 410 | No | Undo window passed |
| AI_EXTRACTION_FAILED | 500 | Yes | AI processing error |
| DATABASE_ERROR | 500 | Yes | Database issue |

---

## Live Budget Updates

When invoices move through the approval/payment workflow, budget data updates automatically:

### On Invoice Approval
- Updates `v2_budget_lines.billed_amount` for each cost code allocation
- Updates `v2_po_line_items.invoiced_amount` if invoice is linked to a PO
- Creates budget line if one doesn't exist for that job/cost code

### On Draw Funding (Invoices Paid)
- Updates `v2_budget_lines.paid_amount` for each cost code allocation

### Budget Calculations
| Field | Meaning |
|-------|---------|
| `budgeted_amount` | Original budget for this cost code |
| `committed_amount` | PO commitments (sum of PO line items) |
| `billed_amount` | Amount billed via approved invoices |
| `paid_amount` | Amount actually paid (after draw funding) |
| Variance | `budgeted_amount - billed_amount` |

---

## Changelog

### 2026-01-06 (Evening)
- **AI Confidence Scoring System**:
  - Added confidence thresholds (HIGH/MEDIUM/LOW)
  - Per-field confidence scores (job, vendor, amount)
  - Review flags for low-confidence invoices
  - Job matching with fuzzy matching (Levenshtein distance)
- **Validation System**:
  - Created server/validation.js with field rules
  - Status transition validation with pre-requirements
  - Duplicate detection via file hash
  - Allocation balance validation
- **Error Handling**:
  - Created server/errors.js with AppError class
  - Structured error codes with retry information
  - Express error middleware
- **Entity Locking**:
  - Created server/locking.js with 5-minute locks
  - Lock acquisition/release/check APIs
  - Automatic cleanup of expired locks
- **Undo System**:
  - Created server/undo.js with 30-second window
  - Automatic reversal of budget/PO updates
  - Undo snapshots for all state changes
- **Realtime Sync**:
  - Created server/realtime.js with SSE handler
  - Supabase Realtime subscriptions
  - Broadcast for invoice/draw/lock changes
- **Frontend Components**:
  - public/js/toasts.js - Toast notifications with undo
  - public/js/realtime.js - SSE client with offline queue
  - public/js/validation.js - Client-side validation
  - public/js/modals.js - Edit modal, job selection modal
- **New API Endpoints**:
  - PATCH /api/invoices/:id - Partial update with locking
  - POST /api/invoices/:id/transition - Status transitions
  - POST /api/locks/acquire - Entity locking
  - POST /api/invoices/:id/undo - Undo operations
  - POST /api/invoices/bulk/* - Bulk operations
  - GET /api/realtime/events - SSE connection
- **Database Migration**:
  - Added soft delete (deleted_at)
  - Added AI metadata columns
  - Added version tracking
  - Created v2_undo_queue, v2_entity_locks, v2_invoice_hashes tables

### 2026-01-06 (Morning)
- Initial setup with invoice approval workflow
- Added AI invoice processing with Claude
- Implemented PDF stamping on approval
- Created standardized file naming
- Added job/vendor/PO auto-matching
- Built filter system (Active, Needs Approval, Archive, etc.)
- Created this documentation file
- Enhanced PDF stamp to include:
  - Cost codes with individual amounts
  - PO number, total, billed amount, and remaining balance
  - Percentage of PO billed
- Fixed vendor auto-creation (removed trade_type column)
- Implemented live budget updates:
  - Auto-update `billed_amount` when invoice approved
  - Auto-update `paid_amount` when draw funded
  - Auto-update `invoiced_amount` on PO line items
