# Ross Built Construction Management System - Complete Technical Documentation

## Overview

This system manages the full invoice-to-payment lifecycle for construction projects, including Purchase Orders, Change Orders, Draws (G702/G703 Pay Applications), Budget tracking, and Lien Releases.

---

## 1. INVOICE SYSTEM

### Status Flow
```
Upload PDF → AI Processing → needs_review → ready_for_approval → approved → in_draw → paid
```

### Status Definitions

| Status | Description | Editing | Requirements |
|--------|-------------|---------|--------------|
| **needs_review** | Accountant reviews, codes invoice | Full edit | None |
| **ready_for_approval** | PM reviews under job | Read-only (unlock available) | job_id + vendor_id |
| **approved** | Ready for draws, PDF stamped | Locked | Allocations sum to amount |
| **in_draw** | Added to payment application | Locked | Must be in a draw |
| **paid** | Terminal state, archived | Locked | Draw must be funded |

### AI Processing (`server/ai-processor.js`)

**Extraction Flow:**
1. PDF text extracted via `pdf-parse`
2. If minimal text (scanned PDF) → OCR via Claude Vision
3. Claude Sonnet 4 extracts structured data:
   - Vendor name + trade type
   - Invoice number, date, amounts
   - Line items with cost code suggestions
   - Job matching with confidence scores

**Trade Type → Cost Code Mapping:**
```
electrical  → 13101 (labor), 13102 (fixtures)
plumbing    → 12101 (labor), 12102 (fixtures)
hvac        → 14101
framing     → 10101 (labor), 10102 (material)
roofing     → 17101
painting    → 27101
drywall     → 24101
...40+ trades mapped
```

**Confidence Thresholds:**
- **HIGH (≥0.90)**: Auto-assign, no review
- **MEDIUM (0.60-0.90)**: Auto-assign + review flag
- **LOW (<0.60)**: Manual selection required

### Invoice Allocations

Each invoice is split across cost codes via `v2_invoice_allocations`:

```sql
invoice_allocations {
  invoice_id      -- Parent invoice
  cost_code_id    -- Which cost code
  amount          -- How much allocated
  job_id          -- For budget tracking
  po_id           -- Links to Purchase Order (optional)
  po_line_item_id -- Specific PO line item (optional)
  change_order_id -- Links to Change Order (optional)
  pending_co      -- True if CO doesn't exist yet
}
```

**Rules:**
- Allocations must sum to invoice amount (±$0.01)
- All allocations need cost codes
- No zero allocations
- CO cost codes (ending in 'C') link to `change_order_id`
- Standard cost codes link to `po_id`
- **Mutual exclusivity**: Cannot have BOTH `po_id` AND `change_order_id`

### PDF Stamping (`server/pdf-stamper.js`)

**Stamp appears top-right corner:**
```
┌─────────────────────────────┐
│ APPROVED (PARTIAL)          │
│ Jan 15, 2026                │
│ by Jake Ross                │
│                             │
│ $17,760.00                  │
│                             │
│ Drummond-501 74th St        │
│                             │
│ 06100 Rough Carpentry       │
│ $17,760.00                  │
│                             │
│ PO: PO-Drummond501-0001     │
│ Billed: $17,760 of $25,000  │
│ Remaining: $7,240 (71%)     │
└─────────────────────────────┘
```

**Status-Based Stamps:**
- **needs_review**: Yellow stamp with vendor, amount, flags
- **ready_for_approval**: Yellow stamp with cost codes
- **approved**: Green stamp with PO billing info
- **in_draw**: Adds blue "IN DRAW #X" overlay
- **paid**: Adds "PAID" stamp with date

### Partial Approvals
- When allocations < invoice amount
- `review_flags` includes `partial_approval`
- Stamp shows "APPROVED (PARTIAL)"
- Orange badge in modal: "Partial"

---

## 2. PURCHASE ORDER (PO) SYSTEM

### PO Structure
```sql
v2_purchase_orders {
  po_number        -- "PO-Drummond501-0001"
  job_id           -- Which job
  vendor_id        -- Which vendor
  total_amount     -- PO value
  original_amount  -- Before change orders
  change_order_total -- Sum of CO adjustments
  status           -- open, closed, cancelled
  approval_status  -- pending, approved, rejected
}

v2_po_line_items {
  po_id
  cost_code_id
  description
  amount           -- Line item budget
  invoiced_amount  -- How much billed against this line
}
```

### PO Billing Tracking

When invoice approved with PO-linked allocations:
1. System calculates amount linked to PO
2. Updates `po_line_items.invoiced_amount`
3. Tracks progress toward line item budget
4. **CO cost codes NEVER count toward PO billing**

### PO Capacity Validation
```
PO Total: $25,000
Previously Billed: $15,000
This Invoice: $8,000
Remaining: $2,000 → OVER by $6,000!
```
- Can override with `overridePoOverage` flag
- Or blocks with error

### PO Number Format
`PO-{JobIdentifier}-{XXXX}`
- JobIdentifier: Client + Street Number (e.g., "Drummond501")
- Sequential 4-digit number

---

## 3. DRAW SYSTEM (G702/G703)

### Draw Structure
```sql
v2_draws {
  job_id
  draw_number      -- Sequential: 1, 2, 3...
  period_end       -- Work through date
  total_amount     -- Sum of invoices
  status           -- draft, submitted, funded
  funded_amount    -- Actual amount funded
}

v2_draw_invoices {
  draw_id
  invoice_id       -- Links invoices to draw
}
```

### G702 Calculations (Application & Certificate for Payment)

```javascript
{
  // Contract
  originalContractSum: $500,000
  netChangeOrders: $25,000
  contractSumToDate: $525,000

  // Billings
  totalCompletedPreviousPeriods: $150,000  // Prior draws
  totalCompletedThisPeriod: $75,000        // This draw
  totalCompletedToDate: $225,000

  // Retainage (10% default)
  retainageOnCompletedWork: $22,500

  // Payment
  lessPreviousCertificates: $135,000       // Prior funded
  currentPaymentDue: $67,500               // This period - retainage
}
```

### G703 Schedule of Values (Per Cost Code)

| Cost Code | Budget | Prev Billed | This Period | Total | % | Remaining |
|-----------|--------|-------------|-------------|-------|---|-----------|
| 06100 Rough Carpentry | $50,000 | $20,000 | $15,000 | $35,000 | 70% | $15,000 |
| 12101 Plumbing Labor | $30,000 | $10,000 | $8,000 | $18,000 | 60% | $12,000 |

### Draw Workflow

1. **Create Draw**: `POST /api/jobs/:id/draws`
2. **Add Invoices**: `POST /api/draws/:id/add-invoices`
   - Invoice status → `in_draw`
   - PDF stamped with "IN DRAW #X"
3. **Submit**: `PATCH /api/draws/:id/submit`
   - Status → `submitted`, locked
4. **Fund**: `PATCH /api/draws/:id/fund`
   - Status → `funded`
   - All invoices → `paid`
   - PDFs stamped with "PAID"

### Draw Exports
- **Excel**: G702 tab + G703 tab + Invoice list
- **PDF**: Formatted AIA-style documents

---

## 4. CHANGE ORDER (CO) SYSTEM

### Job Change Orders (Client Billing)
```sql
v2_job_change_orders {
  job_id
  change_order_number  -- CO-1, CO-2, ...
  title
  reason              -- scope_change, owner_request, unforeseen, design_change

  amount              -- Total CO value
  base_amount         -- Cost before fees
  gc_fee_percent      -- GC markup
  gc_fee_amount       -- Calculated fee

  status              -- draft, pending_approval, approved, rejected
  invoiced_amount     -- How much billed against this CO
}
```

### CO Cost Codes
- Standard code: `26102` (Siding Material)
- CO version: `26102C` (ends with 'C')
- Invoices allocated to CO codes bill against the CO, not base contract

### CO Linking Rules
```
Allocation with cost code "26102C":
  ├── change_order_id: UUID  ← Links to specific CO
  └── po_id: NULL            ← Cannot have both!

Allocation with cost code "26102" (standard):
  ├── change_order_id: NULL
  └── po_id: UUID            ← Links to PO
```

### CO Workflow

1. **Create**: `POST /api/jobs/:jobId/change-orders`
2. **Submit**: `POST /api/change-orders/:id/submit` → pending_approval
3. **Internal Approve**: `POST /api/change-orders/:id/approve` → PM approves
4. **Client Approve**: `POST /api/change-orders/:id/client-approve` → Final
5. Or **Bypass**: `POST /api/change-orders/:id/bypass-client` with reason

### CO in Draws
- CO allocations tracked separately in `v2_job_co_draw_billings`
- Can appear as separate section in G703
- "Pending CO" allocations flagged for resolution

---

## 5. BUDGET SYSTEM

### Budget Lines (Per Job × Cost Code)
```sql
v2_budget_lines {
  job_id
  cost_code_id
  budgeted_amount    -- Original budget
  committed_amount   -- Reserved (PO amounts)
  billed_amount      -- Invoiced
  paid_amount        -- From funded draws
}
```

### Budget Calculations

```javascript
GET /api/jobs/:id/budget

[
  {
    cost_code: "06100 - Rough Carpentry",
    budgeted: $50,000,
    billed: $34,200,
    paid: $28,900,
    variance: $15,800,        // budgeted - billed
    variance_percent: 31.6%   // Positive = under budget
  }
]
```

### How Allocations Affect Budget

1. **Invoice Approved**: `billed_amount` incremented
2. **Draw Funded**: `paid_amount` incremented
3. **PO Created**: `committed_amount` incremented

---

## 6. LIEN RELEASE SYSTEM

### Lien Release Types
- **conditional_progress**: Waives lien only after payment received
- **unconditional_progress**: Unconditional waiver for progress payment
- **conditional_final**: Final conditional waiver
- **unconditional_final**: Final unconditional waiver

### Lien Release Structure
```sql
v2_lien_releases {
  job_id
  vendor_id
  draw_id            -- Optional attachment to draw
  release_type
  release_date
  through_date       -- Work covered through
  amount
  pdf_url

  -- Notary Info
  notary_name
  notary_county
  notary_expiration
  signer_name
  signer_title

  status             -- received, verified, attached
}
```

### Lien Release Workflow
1. **Upload**: PDF stored, record created
2. **AI Process**: Extracts vendor, amount, type, notary info
3. **Verify**: Mark as verified after review
4. **Attach to Draw**: Link to specific draw for documentation

---

## KEY SYSTEM FEATURES

### Entity Locking (`server/locking.js`)
- 5-minute locks prevent concurrent edits
- Acquired when opening for edit
- Released on close or manual unlock
- Auto-cleanup of expired locks

### Undo System (`server/undo.js`)
- 30-second window to undo changes
- Snapshots stored before changes
- Per entity type + ID

### Realtime Updates (`server/realtime.js`)
- Server-Sent Events (SSE)
- Live updates on status changes
- Broadcast on approvals, draws, payments

### Duplicate Detection
- Hash: `vendor_id + invoice_number + amount`
- Stored in `v2_invoice_hashes`
- Blocks re-upload of same invoice

---

## DATABASE RELATIONSHIPS

```
v2_jobs
  ├── v2_budget_lines
  ├── v2_invoices
  ├── v2_draws
  ├── v2_purchase_orders
  └── v2_job_change_orders

v2_invoices
  ├── v2_invoice_allocations
  │   ├── → v2_cost_codes
  │   ├── → v2_purchase_orders (po_id)
  │   └── → v2_job_change_orders (change_order_id)
  ├── → v2_vendors
  ├── → v2_purchase_orders
  └── v2_draw_invoices → v2_draws

v2_purchase_orders
  └── v2_po_line_items → v2_cost_codes
```

---

## API ENDPOINTS

### Invoices
```
GET    /api/invoices                    # List with filters
GET    /api/invoices/:id                # Get details
POST   /api/invoices/process            # AI extract + create
PATCH  /api/invoices/:id                # Update invoice
PATCH  /api/invoices/:id/approve        # Approve + stamp
POST   /api/invoices/:id/allocate       # Set allocations
```

### Draws
```
GET    /api/draws                       # All draws
POST   /api/jobs/:id/draws              # Create draw
POST   /api/draws/:id/add-invoices      # Add invoices
PATCH  /api/draws/:id/submit            # Submit for funding
PATCH  /api/draws/:id/fund              # Mark funded
GET    /api/draws/:id/export/excel      # Export G702/G703
```

### Purchase Orders
```
GET    /api/purchase-orders             # List all
POST   /api/purchase-orders             # Create
PATCH  /api/purchase-orders/:id         # Update
POST   /api/purchase-orders/:id/approve # Approve
```

### Change Orders
```
GET    /api/jobs/:jobId/change-orders   # List for job
POST   /api/jobs/:jobId/change-orders   # Create
POST   /api/change-orders/:id/approve   # Internal approve
POST   /api/change-orders/:id/client-approve # Client approve
```

### Budget
```
GET    /api/jobs/:id/budget             # Budget with actuals
GET    /api/jobs/:id/budget-summary     # Summary view
```

### Lien Releases
```
GET    /api/lien-releases               # List all
POST   /api/lien-releases/process       # AI process
POST   /api/lien-releases/:id/attach-to-draw # Link to draw
```

---

## FILE STRUCTURE

```
Construction-Management-Software/
├── config/
│   └── index.js              # Supabase client config
├── server/
│   ├── index.js              # Express server, all API endpoints
│   ├── ai-processor.js       # AI invoice extraction
│   ├── ai-learning.js        # AI learning from corrections
│   ├── ocr-processor.js      # OCR for scanned PDFs
│   ├── document-converter.js # Multi-format support
│   ├── pdf-stamper.js        # PDF approval stamping
│   ├── validation.js         # Business rules
│   ├── locking.js            # Entity locking
│   ├── undo.js               # Undo system
│   ├── realtime.js           # SSE updates
│   └── storage.js            # Supabase storage helpers
├── public/
│   ├── index.html            # Invoice dashboard
│   ├── draws.html            # Draws management
│   ├── pos.html              # Purchase Orders
│   ├── css/styles.css        # Dark theme styling
│   └── js/
│       ├── modals.js         # Invoice/PO modals
│       ├── toasts.js         # Notifications
│       └── realtime.js       # SSE client
└── database/
    └── migration-*.sql       # Database migrations
```

---

*Last updated: January 2026*
