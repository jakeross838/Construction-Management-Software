# Lovable.dev Prompt: Financial Module

> **Module:** Invoices, Purchase Orders, Draws, Change Orders, Budget Tracking
> **Purpose:** Core money flow for construction management - from invoice receipt through payment

---

## Overview

Build the **Financial Module** for Ross Built Construction Management Software. This module handles the core money flow:

```
Invoice Upload → AI Processing → Review → Approve (stamp PDF) → Add to Draw → Submit → Funded → Mark Paid
```

All pages share a consistent layout with a job selector sidebar and integrate with an existing REST API.

**Base API URL:** `http://localhost:3001/api`

---

## Shared Layout Pattern

All financial pages use this structure:
```
+------------------------------------------------------------------+
| Header Nav: Overview | Sales | Pre-Con | Operations | Financial▼ |
+------------------------------------------------------------------+
| +-------------+  +--------------------------------------------+  |
| | JOB SIDEBAR |  | PAGE CONTENT                               |  |
| | ----------- |  |                                            |  |
| | [All Jobs▼] |  | Filter Bar                                 |  |
| | Job Card    |  | +----------------------------------------+ |  |
| | - Name      |  | | Data Table or Cards                    | |  |
| | - Client    |  | |                                        | |  |
| | - Contract  |  | +----------------------------------------+ |  |
| | - Progress  |  |                                            |  |
| +-------------+  +--------------------------------------------+  |
+------------------------------------------------------------------+
```

**Job Sidebar Component:**
- Dropdown to filter by job (default: "All Jobs")
- Shows selected job's info card: name, client, address, contract amount, % complete progress bar
- Persists selection across financial pages via URL query param or state

---

## 1. INVOICES PAGE (`/invoices`)

### Purpose
Primary workflow page for invoice approval. Invoices are uploaded as PDFs, AI extracts data, user reviews/corrects, approves (which stamps the PDF), adds to a draw, and marks paid when funded.

### Status Flow
```
                    ┌─────────────┐
                    │   Upload    │
                    │    PDF      │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │  received   │ (AI processing)
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
           ┌────────│needs_approval│────────┐
           │        └──────┬──────┘        │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐  ┌─────────────┐
    │   denied    │ │  approved   │  │  (back to   │
    │  (terminal) │ │ (PDF stamped)│  │  received)  │
    └─────────────┘ └──────┬──────┘  └─────────────┘
                           ▼
                    ┌─────────────┐
                    │   in_draw   │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │    paid     │ (terminal)
                    └─────────────┘
```

### Page Layout
```
INVOICES                                          [+ Upload Invoice]

Filter: [Status: All Active ▼] [Job: All ▼] [Vendor: All ▼]  🔍 Search...

┌────────────────────────────────────────────────────────────────────────┐
│ ☐ │ Vendor               │ Invoice #  │ Date     │ Amount   │ Status   │
├────────────────────────────────────────────────────────────────────────┤
│ ☐ │ FL Sunshine Carpentry│ INV-4521   │ Jan 18   │ $17,760  │ 🟡 Needs │
│ ☐ │ Gulf Coast Electric  │ 2026-0089  │ Jan 17   │ $8,450   │ 🟡 Needs │
│ ☐ │ Sarasota Plumbing    │ SP-1234    │ Jan 16   │ $12,300  │ 🟢 Apprvd│
│ ☐ │ ABC Concrete         │ 78965      │ Jan 15   │ $24,500  │ 🟣 InDraw│
│ ☐ │ XYZ Roofing          │ R-2026-42  │ Jan 14   │ $18,900  │ 🔵 Paid  │
└────────────────────────────────────────────────────────────────────────┘

[Bulk Actions ▼]  (Approve Selected | Add to Draw | Deny)

Showing 1-25 of 142                              [< Prev] [Next >]
```

### Status Badges (Colored Pills)
| Status | Color | Meaning |
|--------|-------|---------|
| `received` | Gray | Just uploaded, AI processed |
| `needs_approval` | Amber/Yellow | Ready for review |
| `approved` | Green | Approved, PDF stamped |
| `in_draw` | Purple | Added to a pay application |
| `paid` | Blue | Payment received |
| `denied` | Red | Rejected |

### Upload Invoice Flow

**Step 1: Upload Modal**
```
┌──────────────────────────────────────────────────────────────────┐
│ UPLOAD INVOICE                                              [X]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │              Drag & drop PDF here                          │  │
│  │                     or                                     │  │
│  │               [Browse Files]                               │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Supported: PDF files up to 10MB                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Step 2: AI Processing**
After upload, call `POST /api/invoices/process` with FormData.

Show processing state:
```
┌──────────────────────────────────────────────────────────────────┐
│ PROCESSING INVOICE                                          [X]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    [Spinner Animation]                           │
│                                                                  │
│              Extracting invoice data with AI...                  │
│                                                                  │
│  ✓ Uploading PDF                                                 │
│  ✓ Running OCR (if scanned)                                      │
│  ● Extracting vendor, amount, date...                            │
│  ○ Matching to job and PO                                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Step 3: AI Results with Confidence**

The API returns:
```json
{
  "invoice": { "id": "...", "status": "received", ... },
  "ai_result": {
    "vendor": { "name": "Florida Sunshine Carpentry", "confidence": 0.95 },
    "job": { "name": "Drummond", "confidence": 0.87 },
    "amount": { "value": 17760.00, "confidence": 0.99 },
    "invoice_number": { "value": "INV-4521", "confidence": 0.92 },
    "date": { "value": "2026-01-18", "confidence": 0.88 }
  }
}
```

Show confidence indicators:
- 🟢 High (>90%): Auto-filled, green checkmark
- 🟡 Medium (70-90%): Auto-filled, yellow warning, "Verify"
- 🔴 Low (<70%): Not filled, red highlight, "Enter manually"

### Invoice Detail Modal (Split View)

When clicking a row, open a modal with split layout:

```
┌──────────────────────────────────────────────────────────────────┐
│ Invoice: INV-4521 - Florida Sunshine Carpentry              [X]  │
├───────────────────────────┬──────────────────────────────────────┤
│                           │ INVOICE DETAILS                      │
│   ┌───────────────────┐   │ ──────────────────────────────────── │
│   │                   │   │                                      │
│   │                   │   │ Vendor: [Florida Sunshine ▼] 🟢 95%  │
│   │    PDF PREVIEW    │   │ Invoice #: [INV-4521        ] 🟢 92% │
│   │                   │   │ Date: [Jan 18, 2026    📅] 🟡 88%    │
│   │    (embedded      │   │ Due: [Feb 17, 2026     📅]           │
│   │     iframe or     │   │ Amount: [$17,760.00        ] 🟢 99%  │
│   │     PDF.js)       │   │                                      │
│   │                   │   │ JOB & PO ASSIGNMENT                  │
│   │    scrollable     │   │ Job: [Drummond - 501 74th St ▼] 🟡   │
│   │                   │   │ PO: [PO-Drummond501-0043 ▼]          │
│   │                   │   │     └─ Remaining: $7,240.00          │
│   │                   │   │                                      │
│   │                   │   │ COST ALLOCATIONS                     │
│   │                   │   │ ┌──────────────────────────────────┐ │
│   │                   │   │ │ Cost Code         │ Amount       │ │
│   │                   │   │ ├──────────────────────────────────┤ │
│   │                   │   │ │ 06100 Rough Carp  │ $17,760.00   │ │
│   │                   │   │ │ [+ Add Allocation Line]          │ │
│   │                   │   │ └──────────────────────────────────┘ │
│   │                   │   │ Total: $17,760.00 ✓ (matches amount) │
│   │                   │   │                                      │
│   └───────────────────┘   │ Notes: [Framing labor 2nd floor   ]  │
│                           │                                      │
│                           │ ⚠️ Flags: Amount exceeds PO remaining │
├───────────────────────────┴──────────────────────────────────────┤
│ [Deny]  [Split Invoice]         [Save]      [Approve & Stamp]    │
└──────────────────────────────────────────────────────────────────┘
```

### Key Invoice Behaviors

**1. Allocation Validation**
- Allocations must sum to invoice amount exactly
- Show error if mismatch: "Allocations ($15,000) don't match invoice amount ($17,760)"

**2. PO Overage Warning**
- If invoice amount > PO remaining, show warning
- Prompt: "This invoice exceeds PO remaining by $2,500. Create change order?"

**3. PDF Stamping on Approval**
When approved, the API stamps the PDF with:
```
┌──────────────────────────────────┐
│ APPROVED                         │
│ Date: 1/18/2026                  │
│ By: Jake Ross                    │
│ Job: Drummond-501 74th St        │
│ Amount: $17,760.00               │
│ ─── Cost Codes ───               │
│ 06100 Rough Carpentry ($17,760)  │
│ ─── Purchase Order ───           │
│ PO: PO-Drummond501-0043          │
│ PO Total: $25,000.00             │
│ Billed: $17,760.00 (71%)         │
│ Remaining: $7,240.00             │
└──────────────────────────────────┘
```

**4. Split Invoice Feature**
For invoices that should be split across multiple jobs/POs:
```
┌──────────────────────────────────────────────────────────────────┐
│ SPLIT INVOICE                                               [X]  │
├──────────────────────────────────────────────────────────────────┤
│ Original Invoice: INV-4521 - $17,760.00                          │
│                                                                  │
│ SPLIT INTO:                                                      │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Child 1                                                      │ │
│ │ Job: [Drummond ▼]  PO: [PO-0043 ▼]  Amount: [$12,000    ]   │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ Child 2                                                      │ │
│ │ Job: [Crews ▼]     PO: [PO-0028 ▼]  Amount: [$5,760     ]   │ │
│ │ [+ Add Split]                                                │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Total: $17,760.00 ✓ (matches original)                           │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                    [Cancel]    [Create Splits]   │
└──────────────────────────────────────────────────────────────────┘
```

**5. Credit Invoices**
- Support negative amounts for returns/credits
- Display in red: "-$500.00"
- Subtract from draw totals

**6. Duplicate Detection**
- System checks for duplicate invoices (same vendor + invoice number)
- Show warning: "Possible duplicate: Invoice INV-4521 from this vendor already exists"

### Invoice API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/invoices` | List with filters: `?status=&job_id=&vendor_id=` |
| `GET` | `/api/invoices/:id` | Get invoice with allocations |
| `POST` | `/api/invoices/process` | Upload PDF, AI processes (FormData) |
| `PATCH` | `/api/invoices/:id` | Update fields |
| `POST` | `/api/invoices/:id/allocate` | Set cost code allocations |
| `PATCH` | `/api/invoices/:id/approve` | Approve & stamp PDF |
| `POST` | `/api/invoices/:id/transition` | Change status |
| `POST` | `/api/invoices/:id/split` | Split into children |
| `PATCH` | `/api/invoices/:id/mark-paid` | Mark as paid with payment details |

---

## 2. PURCHASE ORDERS PAGE (`/purchase-orders`)

### Purpose
Track committed costs per vendor/job. POs have line items with cost codes. Invoices are linked against POs to track spending vs commitment.

### PO Status
- `open` - Active, can receive invoices
- `closed` - Complete, no more invoices expected
- `cancelled` - Voided

### Approval Status
- `pending` - Awaiting approval
- `approved` - Approved for use

### Page Layout
```
PURCHASE ORDERS                                      [+ Create PO]

Filter: [Status: Open ▼] [Job: All ▼] [Vendor: All ▼]  🔍 Search...

┌────────────────────────────────────────────────────────────────────────┐
│ PO #              │ Job           │ Vendor         │ Amount  │Invoiced │
├────────────────────────────────────────────────────────────────────────┤
│ PO-Drummond-0043  │ Drummond      │ FL Sunshine    │ $25,000 │ $17,760 │
│                   │               │                │ ████████░░░ 71%   │
│ PO-Drummond-0042  │ Drummond      │ Gulf Coast Elec│ $45,000 │ $8,450  │
│                   │               │                │ ██░░░░░░░░░ 19%   │
│ PO-Crews-0028     │ Crews         │ Sarasota Plumb │ $18,500 │ $18,500 │
│                   │               │                │ ██████████ 100%   │
└────────────────────────────────────────────────────────────────────────┘
```

### PO Detail Modal (Fullscreen with Tabs)

```
┌──────────────────────────────────────────────────────────────────┐
│ PO-Drummond501-0043                              [Approve] [X]   │
│ Florida Sunshine Carpentry │ Drummond - 501 74th St              │
├──────────────────────────────────────────────────────────────────┤
│ [Overview] [Line Items] [Invoices] [Change Orders] [Activity]    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OVERVIEW TAB                                                    │
│  ────────────────────────────────────────────────────────────    │
│  Status: 🟢 Open                    Created: Jan 15, 2026        │
│  Approval: ✓ Approved Jan 16 by Jake Ross                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Original Amount:    $25,000.00                          │     │
│  │ Change Orders:      +$2,500.00                          │     │
│  │ Current Total:      $27,500.00                          │     │
│  │ ───────────────────────────────────────────────────     │     │
│  │ Invoiced:           $17,760.00                          │     │
│  │ Remaining:          $9,740.00                           │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  [████████████████████░░░░░░░░░░░░░░░░░] 65% Invoiced            │
│                                                                  │
│  Scope of Work:                                                  │
│  Framing labor for second floor and roof structure. Includes     │
│  all rough carpentry per plans dated 10/15/2025.                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

LINE ITEMS TAB:
┌──────────────────────────────────────────────────────────────────┐
│ # │ Cost Code          │ Description              │ Amount │Billed│
├──────────────────────────────────────────────────────────────────┤
│ 1 │ 06100 Rough Carp   │ Framing labor - 2nd flr  │$17,500 │$17,760│
│ 2 │ 06100 Rough Carp   │ Framing labor - roof     │ $7,500 │ $0   │
│ 3 │ 06100 Rough Carp   │ Additional blocking (CO) │ $2,500 │ $0   │
├──────────────────────────────────────────────────────────────────┤
│                                         Total:    │$27,500 │$17,760│
└──────────────────────────────────────────────────────────────────┘
                                         [+ Add Line Item]

INVOICES TAB:
┌──────────────────────────────────────────────────────────────────┐
│ Invoice #  │ Date     │ Amount   │ Status   │ Actions            │
├──────────────────────────────────────────────────────────────────┤
│ INV-4521   │ Jan 18   │ $17,760  │ 🟢 Approved │ [View]           │
└──────────────────────────────────────────────────────────────────┘

CHANGE ORDERS TAB:
┌──────────────────────────────────────────────────────────────────┐
│ CO #  │ Description              │ Amount  │ Status   │ Actions  │
├──────────────────────────────────────────────────────────────────┤
│ CO-1  │ Additional blocking      │ $2,500  │ ✓ Approved│ [View]  │
└──────────────────────────────────────────────────────────────────┘
                                          [+ Add Change Order]

ACTIVITY TAB:
┌──────────────────────────────────────────────────────────────────┐
│ Jan 18 10:30 AM │ Invoice INV-4521 linked ($17,760) │ System     │
│ Jan 16  2:15 PM │ PO approved                       │ Jake Ross  │
│ Jan 15  4:00 PM │ PO created                        │ Jake Ross  │
└──────────────────────────────────────────────────────────────────┘
```

### Create PO Modal

```
┌──────────────────────────────────────────────────────────────────┐
│ CREATE PURCHASE ORDER                                       [X]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Job: [Select Job ▼]                         * Required           │
│ Vendor: [Select Vendor ▼]                   * Required           │
│                                                                  │
│ Description:                                                     │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Framing labor and materials for second floor                 │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Scope of Work: (optional)                                        │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Complete framing per approved plans. Includes:               │ │
│ │ - Floor joists and subfloor                                  │ │
│ │ - Wall framing and headers                                   │ │
│ │ - Roof trusses installation                                  │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ LINE ITEMS                                                       │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Cost Code [▼]         │ Description          │ Amount        │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ [06100 Rough Carp ▼]  │ [Framing labor    ]  │ [$17,500   ]  │ │
│ │ [06100 Rough Carp ▼]  │ [Roof framing     ]  │ [$7,500    ]  │ │
│ │ [+ Add Line Item]                                            │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                          Total: $25,000.00       │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                    [Cancel]    [Create PO]       │
└──────────────────────────────────────────────────────────────────┘
```

### PO Number Format
Auto-generated: `PO-{JobIdentifier}-{XXXX}`
- Example: `PO-Drummond501-0043`
- JobIdentifier = Client name + street number (e.g., Drummond501)

### PO API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/purchase-orders` | List with filters |
| `GET` | `/api/purchase-orders/:id` | Get with line items, invoices, COs |
| `POST` | `/api/purchase-orders` | Create with line items |
| `PATCH` | `/api/purchase-orders/:id` | Update |
| `POST` | `/api/purchase-orders/:id/approve` | Approve |
| `GET` | `/api/pos/stats` | Statistics summary |

---

## 3. DRAWS PAGE (`/draws`)

### Purpose
Create pay applications (AIA G702/G703 format) by grouping approved invoices. Draws are submitted to clients/lenders for payment.

### Draw Status Flow
```
draft → submitted → funded
```

### Page Layout
```
DRAWS (Pay Applications)                              [+ New Draw]

Job: [Drummond - 501 74th St ▼]

┌────────────────────────────────────────────────────────────────────┐
│ Contract: $1,250,000 │ Drawn: $562,500 │ Remaining: $687,500       │
│ [██████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 45%       │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ Draw # │ Period         │ Amount    │ Status     │ Submitted  │       │
├────────────────────────────────────────────────────────────────────────┤
│ #4     │ Jan 1-31, 2026 │ $85,450   │ 📝 Draft   │ -          │ [Edit]│
│ #3     │ Dec 1-31, 2025 │ $125,000  │ 💰 Funded  │ Dec 28     │ [View]│
│ #2     │ Nov 1-30, 2025 │ $187,500  │ 💰 Funded  │ Nov 29     │ [View]│
│ #1     │ Oct 1-31, 2025 │ $250,000  │ 💰 Funded  │ Oct 30     │ [View]│
└────────────────────────────────────────────────────────────────────────┘
```

### Draw Detail Modal (Fullscreen with Tabs)

```
┌──────────────────────────────────────────────────────────────────┐
│ Draw #4 - Drummond - 501 74th St        [Export ▼] [Submit]  [X] │
│ Period: January 1-31, 2026 │ Status: 📝 Draft                    │
├──────────────────────────────────────────────────────────────────┤
│ [Summary] [G702] [G703 Schedule of Values] [Invoices]            │
├──────────────────────────────────────────────────────────────────┤

SUMMARY TAB:
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Application Number: 4                                           │
│  Period To: January 31, 2026                                     │
│  Invoices Included: 12                                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Total Completed This Period:       $85,450.00           │     │
│  │ Less Retainage (10%):             -$8,545.00            │     │
│  │ ─────────────────────────────────────────────────       │     │
│  │ Current Payment Due:              $76,905.00            │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

G702 TAB (AIA Document G702):
┌──────────────────────────────────────────────────────────────────┐
│ ╔════════════════════════════════════════════════════════════╗   │
│ ║        APPLICATION AND CERTIFICATE FOR PAYMENT             ║   │
│ ║                      AIA DOCUMENT G702                     ║   │
│ ╠════════════════════════════════════════════════════════════╣   │
│ ║ TO OWNER: John & Sarah Drummond                            ║   │
│ ║ FROM CONTRACTOR: Ross Built Custom Homes                   ║   │
│ ║ PROJECT: 501 74th Street, Sarasota FL 34242               ║   │
│ ║ APPLICATION NO: 4          PERIOD TO: January 31, 2026    ║   │
│ ╠════════════════════════════════════════════════════════════╣   │
│ ║                                                            ║   │
│ ║ 1. ORIGINAL CONTRACT SUM                    $1,200,000.00 ║   │
│ ║ 2. Net change by Change Orders                 +$8,500.00 ║   │
│ ║ 3. CONTRACT SUM TO DATE (Line 1 + 2)        $1,208,500.00 ║   │
│ ║ 4. TOTAL COMPLETED & STORED TO DATE           $647,950.00 ║   │
│ ║    (Column G on G703)                                      ║   │
│ ║ 5. RETAINAGE:                                              ║   │
│ ║    a. 10% of Completed Work                   -$64,795.00 ║   │
│ ║    b. 10% of Stored Material                        $0.00 ║   │
│ ║    Total Retainage (Line 5a + 5b)             -$64,795.00 ║   │
│ ║ 6. TOTAL EARNED LESS RETAINAGE                $583,155.00 ║   │
│ ║    (Line 4 less Line 5 Total)                              ║   │
│ ║ 7. LESS PREVIOUS CERTIFICATES FOR PAYMENT    -$506,250.00 ║   │
│ ║    (Line 6 from prior Certificate)                         ║   │
│ ║ 8. CURRENT PAYMENT DUE                         $76,905.00 ║   │
│ ║ 9. BALANCE TO FINISH, INCLUDING RETAINAGE     $625,345.00 ║   │
│ ║    (Line 3 less Line 6)                                    ║   │
│ ║                                                            ║   │
│ ╚════════════════════════════════════════════════════════════╝   │
└──────────────────────────────────────────────────────────────────┘

G703 TAB (Schedule of Values):
┌──────────────────────────────────────────────────────────────────┐
│ ╔════════════════════════════════════════════════════════════════╗
│ ║              CONTINUATION SHEET - AIA DOCUMENT G703            ║
│ ╠════════════════════════════════════════════════════════════════╣
│ ║ A   │ B              │ C         │ D        │ E      │ F      ║
│ ║ #   │ Description    │ Scheduled │ Previous │ This   │ Total  ║
│ ║     │ of Work        │ Value     │ Apps     │ Period │ Compl. ║
│ ╠════════════════════════════════════════════════════════════════╣
│ ║ 1   │ General Cond   │ $75,000   │ $45,000  │$12,500 │$57,500 ║
│ ║ 2   │ Site Work      │ $35,000   │ $35,000  │ $0     │$35,000 ║
│ ║ 3   │ Concrete       │ $85,000   │ $85,000  │ $0     │$85,000 ║
│ ║ 4   │ Rough Framing  │ $125,000  │ $62,500  │$42,500 │$105,000║
│ ║ 5   │ Insulation     │ $18,000   │ $0       │$18,000 │$18,000 ║
│ ║ 6   │ Doors/Windows  │ $22,000   │ $0       │$12,450 │$12,450 ║
│ ║ ... │ ...            │ ...       │ ...      │ ...    │ ...    ║
│ ╠════════════════════════════════════════════════════════════════╣
│ ║     │ GRAND TOTAL    │$1,200,000 │$562,500  │$85,450 │$647,950║
│ ╚════════════════════════════════════════════════════════════════╝
│                                                                  │
│ ╔════════════════════════════════════════════════════════════════╗
│ ║ G      │ H     │ I           │ J          │                   ║
│ ║ %      │ Bal.  │ Retainage   │            │                   ║
│ ║ Compl. │ Rem.  │ (10%)       │            │                   ║
│ ╠════════════════════════════════════════════════════════════════╣
│ ║ 77%    │$17,500│ $5,750      │            │                   ║
│ ║ 100%   │ $0    │ $3,500      │            │                   ║
│ ║ 100%   │ $0    │ $8,500      │            │                   ║
│ ║ 84%    │$20,000│ $10,500     │            │                   ║
│ ║ 100%   │ $0    │ $1,800      │            │                   ║
│ ║ 57%    │$9,550 │ $1,245      │            │                   ║
│ ╠════════════════════════════════════════════════════════════════╣
│ ║ 54%    │$552,050│ $64,795    │            │                   ║
│ ╚════════════════════════════════════════════════════════════════╝
└──────────────────────────────────────────────────────────────────┘

INVOICES TAB:
┌──────────────────────────────────────────────────────────────────┐
│ Invoices in this Draw (12)                   [+ Add Invoices]    │
├──────────────────────────────────────────────────────────────────┤
│ │ Vendor                │ Invoice # │ Amount   │ Cost Code │ ✕  │
├──────────────────────────────────────────────────────────────────┤
│ │ FL Sunshine Carpentry │ INV-4521  │ $17,760  │ 06100     │ ✕  │
│ │ Gulf Coast Electric   │ 2026-0089 │ $8,450   │ 16000     │ ✕  │
│ │ Sarasota Plumbing     │ SP-1234   │ $12,300  │ 15100     │ ✕  │
│ │ ...                   │ ...       │ ...      │ ...       │ ✕  │
├──────────────────────────────────────────────────────────────────┤
│                               Total This Draw: $85,450.00        │
└──────────────────────────────────────────────────────────────────┘
```

### Add Invoices Modal

Shows approved invoices not yet in any draw:
```
┌──────────────────────────────────────────────────────────────────┐
│ ADD INVOICES TO DRAW #4                                     [X]  │
├──────────────────────────────────────────────────────────────────┤
│ Available Approved Invoices:                                     │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ☑ │ Vendor              │ Invoice # │ Amount   │ Cost Code   │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ ☑ │ ABC Drywall         │ DW-2026-15│ $8,200   │ 09000       │ │
│ │ ☑ │ Premium Paint Co    │ PP-445    │ $3,500   │ 09900       │ │
│ │ ☐ │ Tile Masters        │ TM-1122   │ $6,800   │ 09300       │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Selected: 2 invoices totaling $11,700.00                         │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                    [Cancel]    [Add to Draw]     │
└──────────────────────────────────────────────────────────────────┘
```

### Export Options
- **Excel**: Full G702/G703 spreadsheet
- **PDF**: Formatted pay application document

### Fund Draw Modal
```
┌──────────────────────────────────────────────────────────────────┐
│ MARK DRAW AS FUNDED                                         [X]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Draw #4 - Requested: $76,905.00                                  │
│                                                                  │
│ Funded Amount: [$76,905.00          ]                            │
│ Funded Date:   [Jan 25, 2026      📅]                            │
│                                                                  │
│ Note: This will mark all invoices in this draw as "paid"         │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                    [Cancel]    [Mark Funded]     │
└──────────────────────────────────────────────────────────────────┘
```

### Draw API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/draws?job_id=&status=` | List draws |
| `GET` | `/api/draws/:id` | Get with G702/G703 data |
| `POST` | `/api/jobs/:id/draws` | Create new draw |
| `POST` | `/api/draws/:id/add-invoices` | Add invoices to draw |
| `POST` | `/api/draws/:id/remove-invoice` | Remove invoice |
| `PATCH` | `/api/draws/:id/submit` | Submit draw |
| `PATCH` | `/api/draws/:id/fund` | Mark funded |
| `GET` | `/api/draws/:id/export/excel` | Download Excel |
| `GET` | `/api/draws/:id/export/pdf` | Download PDF |

---

## 4. CHANGE ORDERS PAGE (`/change-orders`)

### Purpose
Track scope and cost changes to the contract. Changes can be additions, deductions, or modifications. They can be linked to POs.

### Change Order Types
- `addition` - New scope added
- `deduction` - Scope removed (negative amount)
- `change` - Modified scope (can be + or -)
- `upgrade` - Client upgrade from allowance

### Status Flow
```
draft → pending → approved
           ↓
        rejected
```

### Page Layout
```
CHANGE ORDERS                                          [+ New CO]

Job: [Drummond - 501 74th St ▼]

┌────────────────────────────────────────────────────────────────────┐
│ Summary: 5 COs │ Approved: +$12,500 │ Pending: +$3,200 │ Net: +$15,700
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ CO #  │ Description                  │ Amount  │ Type     │ Status     │
├────────────────────────────────────────────────────────────────────────┤
│ CO-5  │ Add outlet in pantry         │ +$350   │ Addition │ ⏳ Pending │
│ CO-4  │ Upgrade to quartz counters   │ +$2,850 │ Upgrade  │ ⏳ Pending │
│ CO-3  │ Move laundry plumbing        │ +$1,200 │ Change   │ ✓ Approved │
│ CO-2  │ Add recessed lights (6)      │ +$1,800 │ Addition │ ✓ Approved │
│ CO-1  │ Extend patio 4 feet          │ +$9,500 │ Addition │ ✓ Approved │
└────────────────────────────────────────────────────────────────────────┘
```

### Change Order Detail Panel

```
┌──────────────────────────────────────────────────────────────────┐
│ CO-5: Add electrical outlet in pantry               [Print PDF]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Status: ⏳ Pending Approval                                      │
│  Created: Jan 19, 2026                                           │
│  Requested By: Client                                            │
│  Type: Addition                                                  │
│                                                                  │
│  DESCRIPTION                                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Client requests additional 120V outlet on pantry wall   │    │
│  │ for appliance charging station.                         │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  COST BREAKDOWN                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Item                                    │ Amount         │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │ Labor (2 hrs @ $85)                     │ $170.00        │    │
│  │ Materials                               │ $45.00         │    │
│  │ Permit fee                              │ $103.00        │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │ Subtotal                                │ $318.00        │    │
│  │ Markup (10%)                            │ $32.00         │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │ TOTAL                                   │ $350.00        │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  LINKED TO                                                       │
│  PO: PO-Drummond501-0042 (Gulf Coast Electric)                   │
│                                                                  │
│  CLIENT SIGNATURE                                                │
│  [ ] Client approval required                                    │
│  Signed: _____________________ Date: __________                  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [Reject]        [Request Revision]        [Approve]              │
└──────────────────────────────────────────────────────────────────┘
```

### Create Change Order Modal

```
┌──────────────────────────────────────────────────────────────────┐
│ NEW CHANGE ORDER                                            [X]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Job: [Drummond - 501 74th St ▼]             * Required           │
│                                                                  │
│ Type: [Addition ▼]                                               │
│       • Addition - New scope added                               │
│       • Deduction - Scope removed                                │
│       • Change - Modified scope                                  │
│       • Upgrade - Client upgrade                                 │
│                                                                  │
│ Requested By: [Client ▼]                                         │
│               • Client                                           │
│               • Builder                                          │
│               • Architect                                        │
│                                                                  │
│ Description:                                                     │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Add electrical outlet on pantry wall for charging station    │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ COST BREAKDOWN                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Item                                    │ Amount              │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ [Labor (2 hrs @ $85)              ]     │ [$170.00       ]    │ │
│ │ [Materials                        ]     │ [$45.00        ]    │ │
│ │ [Permit fee                       ]     │ [$103.00       ]    │ │
│ │ [+ Add Line Item]                                            │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Markup: [10]%                              Markup: $31.80        │
│                                                                  │
│                                           TOTAL: $349.80         │
│                                                                  │
│ Link to PO: [Select PO (optional) ▼]                             │
│             • Create new PO                                      │
│             • PO-Drummond501-0042 (Gulf Coast Electric)          │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                    [Cancel]    [Create CO]       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. BUDGET TRACKING PAGE (`/budget`)

### Purpose
Compare budgeted amounts vs committed (POs) vs billed (invoices) per cost code. Highlight variances and over-budget items.

### Page Layout
```
BUDGET TRACKING                                     [Export Excel]

Job: [Drummond - 501 74th St ▼]

┌────────────────────────────────────────────────────────────────────┐
│ Contract: $1,200,000 │ Budget: $1,080,000 │ Target Margin: 10%     │
└────────────────────────────────────────────────────────────────────┘

┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 📊 $486,000 │ │ 📋 $412,000 │ │ 💰 $368,000 │ │ ⚠️ -$8,200  │
│ Budgeted    │ │ Committed   │ │ Billed      │ │ Over Budget │
│ to Date     │ │ (POs)       │ │ to Date     │ │ (2 codes)   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│Code  │ Description       │ Budget   │Committed│ Billed  │ Variance     │
├────────────────────────────────────────────────────────────────────────┤
│03000 │ Concrete          │ $45,000  │ $43,500 │ $43,500 │ ✓ +$1,500   │
│06100 │ Rough Carpentry   │ $85,000  │ $82,000 │ $68,400 │ ✓ +$3,000   │
│06200 │ Finish Carpentry  │ $35,000  │ $0      │ $0      │   -         │
│07000 │ Roofing           │ $28,000  │ $27,500 │ $27,500 │ ✓ +$500     │
│09000 │ Drywall           │ $22,000  │ $0      │ $0      │   -         │
│15100 │ Plumbing          │ $38,000  │ $42,200 │ $36,200 │ ⚠️ -$4,200  │
│16000 │ Electrical        │ $45,000  │ $49,000 │ $42,500 │ ⚠️ -$4,000  │
│15500 │ HVAC              │ $52,000  │ $48,900 │ $48,900 │ ✓ +$3,100   │
│...   │ ...               │ ...      │ ...     │ ...     │ ...         │
├────────────────────────────────────────────────────────────────────────┤
│TOTAL │                   │$1,080,000│ $412,000│ $368,000│ -$8,200      │
└────────────────────────────────────────────────────────────────────────┘

Budget Health: [██████████████░░░░░░░░░░░░░░░░░░░░░░░░░] 38% committed

⚠️ 2 cost codes over budget - review recommended
```

### Variance Indicators
- ✓ Green: Under budget (positive variance)
- ⚠️ Red: Over budget (negative variance)
- Gray dash: Not yet committed

### Cost Code Drill-Down

Clicking a row expands to show POs and invoices:
```
┌────────────────────────────────────────────────────────────────────────┐
│15100 │ Plumbing          │ $38,000  │ $42,200 │ $36,200 │ ⚠️ -$4,200  │
├────────────────────────────────────────────────────────────────────────┤
│  └─ PURCHASE ORDERS                                                    │
│     ├─ PO-Drummond-0041 │ Sarasota Plumbing │ $36,200 │ $36,200 billed│
│     └─ PO-Drummond-0048 │ Gulf Plumbing     │ $6,000  │ $0 billed     │
│                                                                        │
│  └─ INVOICES                                                          │
│     ├─ SP-1234    │ Jan 16 │ $12,300 │ Approved                       │
│     ├─ SP-1289    │ Jan 20 │ $15,400 │ In Draw                        │
│     └─ SP-1301    │ Jan 22 │ $8,500  │ Approved                       │
└────────────────────────────────────────────────────────────────────────┘
```

### Budget API Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/jobs/:id/budget` | Budget with committed/billed by cost code |

Response:
```json
{
  "job": { "id": "...", "name": "Drummond", "contract_amount": 1200000 },
  "budget_lines": [
    {
      "cost_code": "03000",
      "name": "Concrete",
      "budgeted": 45000,
      "committed": 43500,
      "billed": 43500,
      "paid": 43500
    }
  ],
  "totals": {
    "budgeted": 1080000,
    "committed": 412000,
    "billed": 368000,
    "paid": 340000
  }
}
```

---

## Shared Components

### Dropdown Data Sources

**Jobs Dropdown:**
```
GET /api/jobs
Display: "{name}" (e.g., "Drummond - 501 74th St")
```

**Vendors Dropdown:**
```
GET /api/vendors
Display: "{name}" (e.g., "Florida Sunshine Carpentry")
```

**Cost Codes Dropdown:**
```
GET /api/cost-codes
Display: "{code} - {name}" (e.g., "06100 - Rough Carpentry")
```

**POs Dropdown (filtered by job):**
```
GET /api/purchase-orders?job_id={id}
Display: "{po_number} - {vendor_name} (${remaining})"
```

### Toast Notifications

| Action | Type | Message |
|--------|------|---------|
| Invoice approved | Success (green) | "Invoice approved and PDF stamped" |
| PO created | Success (green) | "PO created: PO-Drummond501-0044" |
| Draw submitted | Info (blue) | "Draw #4 submitted for approval" |
| Validation error | Error (red) | "Allocations must equal invoice amount" |
| API error | Error (red) | "Failed to save. Please try again." |

### Empty States

**Invoices:**
```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                         📄                                       │
│                                                                  │
│               No invoices yet                                    │
│                                                                  │
│     Upload your first invoice to start tracking costs            │
│                                                                  │
│                    [+ Upload Invoice]                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**POs:**
```
No purchase orders for this job.
Create a PO to commit costs to vendors.
[+ Create PO]
```

**Draws:**
```
No draws created yet.
Create a draw to request payment from the client.
[+ New Draw]
```

**Change Orders:**
```
No change orders for this job.
[+ New Change Order]
```

---

## Additional System Features

### 1. Entity Locking
When a user opens an invoice/PO for editing, it's locked for 5 minutes to prevent conflicts.

Show lock indicator: "🔒 Being edited by Jake Ross"

### 2. Undo System
After certain actions (approve, deny, status change), show undo toast for 30 seconds:
```
┌────────────────────────────────────────────┐
│ Invoice approved          [Undo] │ 28s    │
└────────────────────────────────────────────┘
```

### 3. Realtime Updates
Optional: Connect to SSE endpoint `/api/realtime/events` for live updates when other users make changes.

### 4. Keyboard Shortcuts
- `Ctrl+S` - Save current form
- `Escape` - Close modal
- `Tab` - Navigate between fields
- `Enter` - Submit/Approve (when focused on action button)

---

## Notes for Implementation

1. **Currency Formatting**: All amounts are stored as decimals. Format as `$12,345.67` on display.

2. **Date Formatting**: API uses ISO 8601. Display as "Jan 18, 2026" or "1/18/2026".

3. **UUID Format**: All IDs are UUIDs (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

4. **Error Handling**: Show user-friendly error messages. Log technical details to console.

5. **Loading States**: Show skeleton loaders for tables, spinners for buttons.

6. **Mobile**: These pages are primarily desktop, but should be usable on tablet in landscape.

---

This document covers the complete Financial Module functionality for the Ross Built Construction Management System.
