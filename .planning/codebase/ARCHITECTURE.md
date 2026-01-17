# Architecture

## Overview

Monolithic Express.js application with vanilla JavaScript frontend. No build step, direct file serving.

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ HTML Pages  │  │ Vanilla JS  │  │ CSS (Dark Theme)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/SSE
┌─────────────────────────────────────────────────────────────┐
│                   Express.js Server                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Routes    │  │  Services   │  │    Middleware       │  │
│  │  /api/*     │  │ AI, PDF,    │  │  CORS, JSON,        │  │
│  │             │  │ Storage     │  │  Compression        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Supabase   │  │  Anthropic  │  │  Supabase Storage   │  │
│  │  PostgreSQL │  │  Claude API │  │  (File Uploads)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Server Architecture

### Entry Point
- `server/index.js` - Main Express app
- Mounts all routes
- Serves static files from `public/`

### Route Organization
```
server/
├── index.js              # Main app, common routes
└── routes/
    ├── invoices.js       # Invoice CRUD, approval, billing
    ├── purchase-orders.js # PO management, change orders
    ├── draws.js          # Draw management, G702/G703
    ├── jobs.js           # Job management, budgets
    ├── vendors.js        # Vendor management
    ├── punch-lists.js    # Punch list tracking
    ├── inspections.js    # Inspection management
    ├── schedules.js      # Schedule tasks
    ├── daily-logs.js     # Daily log entries
    ├── documents.js      # Document management
    ├── change-orders.js  # Job-level change orders
    ├── cost-codes.js     # Cost code management
    ├── ai.js             # AI stats and learning
    ├── dashboard.js      # Dashboard metrics
    ├── locks.js          # Entity locking
    ├── undo.js           # Undo operations
    └── realtime.js       # SSE connections
```

### Service Layer
```
server/
├── ai-processor.js       # Invoice AI extraction
├── ai-document-processor.js # General document AI
├── ai-learning.js        # AI learning from corrections
├── ocr-processor.js      # OCR via Claude Vision
├── pdf-stamper.js        # Approval stamp on PDFs
├── document-converter.js # PDF to image for OCR
├── duplicate-check.js    # Invoice duplicate detection
├── storage.js            # Supabase storage helpers
├── validation.js         # Data validation rules
├── locking.js            # Entity lock management
├── undo.js               # Undo queue management
├── realtime.js           # SSE broadcast
├── errors.js             # AppError class
└── standards.js          # Naming conventions
```

## Data Flow

### Request Processing
```
HTTP Request
    │
    ▼
Express Middleware (CORS, JSON, Compression)
    │
    ▼
Route Handler
    │
    ▼
Supabase Query
    │
    ▼
JSON Response
```

### Invoice Processing Flow
```
PDF Upload (multipart/form-data)
    │
    ▼
Multer (temp file)
    │
    ▼
PDF Text Extraction
    │
    ├── Text found ─────────────┐
    │                           │
    ▼                           ▼
OCR (Claude Vision)      Direct to AI
    │                           │
    └───────────┬───────────────┘
                ▼
        AI Extraction (Claude)
                │
                ▼
        Auto-matching (job, vendor, PO)
                │
                ▼
        Save to Database
                │
                ▼
        Upload PDF to Storage
```

### Approval Flow
```
Invoice (received)
    │
    ▼ AI Processing
Invoice (needs_approval)
    │
    ▼ PM Reviews
Approve with Allocations
    │
    ├── PDF Stamped with approval mark
    │
    ▼
Invoice (approved)
    │
    ▼ Add to Draw
Invoice (in_draw)
    │
    ▼ Client Pays
Invoice (paid)
```

## Frontend Architecture

### Page Structure
Each page is self-contained HTML with inline or linked JS:
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <!-- Page content -->
  <script src="js/api-cache.js"></script>
  <script src="js/toasts.js"></script>
  <script src="js/nav-sidebar.js"></script>
  <script src="js/[page-specific].js"></script>
</body>
</html>
```

### Shared Components
- `api-cache.js` - Cached API fetches
- `toasts.js` - Notification system
- `nav-sidebar.js` - Navigation
- `realtime.js` - SSE client
- `modals.js` - Invoice modal helpers
- `po-modals.js` - PO modal class

### Modal Pattern
```javascript
// Open
modal.style.display = 'flex';
modal.classList.add('show');

// Close
modal.classList.remove('show');
modal.style.display = 'none';
```

## Database Architecture

### Table Naming
- All tables prefixed with `v2_`
- Soft deletes via `deleted_at` column
- Audit trails via `*_activity` tables

### Core Entities
```
v2_jobs ──────────┬──────────── v2_invoices
                  │                  │
                  │                  │
v2_vendors ───────┼──────────────────┤
                  │                  │
                  │                  ▼
v2_cost_codes ────┼───────── v2_invoice_allocations
                  │
                  ├──────────── v2_purchase_orders
                  │                  │
                  │                  ▼
                  │           v2_po_line_items
                  │
                  ├──────────── v2_draws
                  │                  │
                  │                  ▼
                  │           v2_draw_invoices
                  │
                  ├──────────── v2_punch_lists
                  │                  │
                  │                  ▼
                  │           v2_punch_list_items
                  │
                  └──────────── v2_budget_lines
```

## Real-time Architecture

### SSE (Server-Sent Events)
```
Client                    Server
  │                         │
  ├── GET /api/sse ────────►│
  │                         │
  │◄──── Connection ────────┤
  │                         │
  │◄──── data: {...} ───────┤ (on DB change)
  │                         │
  │◄──── data: {...} ───────┤ (on DB change)
  │                         │
```

### Broadcast Pattern
```javascript
// Server broadcasts on data changes
broadcast({ type: 'invoice_updated', payload: invoice });

// Client receives and updates UI
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'invoice_updated') {
    updateInvoiceInUI(data.payload);
  }
};
```

## Error Handling

### Server Errors
```javascript
class AppError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
```

### Client Errors
```javascript
try {
  const response = await fetch('/api/...');
  if (!response.ok) {
    const error = await response.json();
    showToast(error.message, 'error');
  }
} catch (err) {
  showToast('Network error', 'error');
}
```
