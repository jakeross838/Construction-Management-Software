# Coding Conventions

## JavaScript Style

### General
- ES6+ syntax (const/let, arrow functions, async/await)
- No TypeScript
- No build step/transpilation
- 2-space indentation

### Naming
```javascript
// Variables: camelCase
const invoiceId = '123';
let currentStatus = 'pending';

// Functions: camelCase, verb prefix
function loadInvoices() { }
function handleApprove() { }
async function fetchJobs() { }

// Classes: PascalCase
class POModalManager { }
class AppError { }

// Constants: UPPER_SNAKE_CASE
const DEFAULT_RETAINAGE_PERCENT = 10.00;
const STATUS_APPROVED = 'approved';

// Private methods: underscore prefix (convention)
_internalHelper() { }
```

### Async Patterns
```javascript
// Always use async/await (not .then())
async function loadData() {
  try {
    const { data, error } = await supabase.from('table').select();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Load failed:', err);
    throw err;
  }
}
```

## File Naming

### Backend
```
server/
├── routes/
│   └── purchase-orders.js   # kebab-case for routes
├── ai-processor.js          # kebab-case for services
└── errors.js                # lowercase for utilities
```

### Frontend
```
public/
├── js/
│   ├── po-modals.js         # kebab-case
│   └── api-cache.js         # kebab-case
└── punch-lists.html         # kebab-case
```

### Database
```
database/
└── migration-038-punch-lists.sql  # Numbered, kebab-case description
```

## Database Conventions

### Table Naming
```sql
-- All tables prefixed with v2_
v2_invoices
v2_purchase_orders
v2_punch_list_items

-- Junction tables: entity1_entity2
v2_draw_invoices
v2_co_line_items

-- Activity tables: entity_activity
v2_invoice_activity
v2_po_activity
```

### Column Naming
```sql
-- snake_case for all columns
id UUID PRIMARY KEY
job_id UUID REFERENCES
created_at TIMESTAMPTZ
deleted_at TIMESTAMPTZ
total_amount DECIMAL
```

### Soft Deletes
```sql
-- Always use deleted_at for soft deletes
deleted_at TIMESTAMPTZ

-- Query pattern
SELECT * FROM v2_invoices WHERE deleted_at IS NULL
```

### Status Fields
```sql
-- Use TEXT with CHECK constraints
status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'))
```

## API Conventions

### Endpoint Naming
```
GET    /api/invoices          # List
GET    /api/invoices/:id      # Get one
POST   /api/invoices          # Create
PATCH  /api/invoices/:id      # Update
DELETE /api/invoices/:id      # Soft delete

# Actions
POST   /api/invoices/:id/approve
POST   /api/invoices/:id/transition
GET    /api/invoices/:id/activity

# Nested resources
GET    /api/purchase-orders/:id/invoices
POST   /api/purchase-orders/:id/line-items
```

### Response Format
```javascript
// Success (list)
{ data: [...], count: 10 }

// Success (single)
{ data: {...} }

// Error
{
  error: 'ERROR_CODE',
  message: 'Human readable message',
  details: { ... }  // optional
}
```

### Error Codes
```javascript
// Use UPPER_SNAKE_CASE for error codes
'INVOICE_NOT_FOUND'
'PO_ALREADY_APPROVED'
'PUNCH_ITEMS_BLOCKING'
'INVALID_TRANSITION'
```

## CSS Conventions

### Variables
```css
:root {
  --bg-primary: #0d1117;
  --bg-card: #161b22;
  --text-primary: #e6edf3;
  --accent-blue: #58a6ff;
  --border: #30363d;
}
```

### Class Naming
```css
/* Component-based naming */
.modal { }
.modal-content { }
.modal-header { }
.modal-body { }
.modal-footer { }

/* State modifiers */
.modal.show { }
.btn.btn-primary { }
.status-badge.status-approved { }

/* Layout */
.form-row { }
.form-group { }
.filter-controls { }
```

### BEM-ish Pattern
```css
/* Block */
.inspection-stats-bar { }

/* Element */
.stat-item { }
.stat-value { }
.stat-label { }

/* Modifier */
.stat-value.stat-failed { }
.stat-value.stat-passed { }
```

## HTML Conventions

### ID Naming
```html
<!-- camelCase for IDs -->
<div id="createModal"></div>
<input id="formTitle">
<select id="statusFilter">
```

### Event Handlers
```html
<!-- Inline handlers for simple actions -->
<button onclick="openModal()">Open</button>
<button onclick="closeModal()">Close</button>

<!-- Or data attributes for JS binding -->
<button data-action="approve" data-id="123">Approve</button>
```

### Form Structure
```html
<div class="form-group">
  <label for="fieldName">Label *</label>
  <input type="text" id="fieldName" class="form-control" required>
</div>

<div class="form-row">
  <div class="form-group">...</div>
  <div class="form-group">...</div>
</div>
```

## Comment Conventions

### File Headers
```javascript
// Not used - files are self-documenting by name
```

### Function Comments
```javascript
// Brief comment for non-obvious logic only
// Calculates retainage based on verified punch items
function calculateRetainage(po) { }
```

### TODO/FIXME
```javascript
// TODO: Add pagination for large result sets
// FIXME: Handle edge case when vendor is null
```

## Import/Export

### Backend (CommonJS)
```javascript
// Imports at top
const express = require('express');
const { supabase } = require('../config');
const { AppError } = require('./errors');

// Export at bottom
module.exports = router;
module.exports = { functionA, functionB };
```

### Frontend (Browser globals)
```javascript
// No module system
// Files loaded via <script> tags
// Classes/functions attached to window or used directly
```

## Error Handling

### Backend
```javascript
// Use AppError for known errors
throw new AppError('CODE', 'Message', 400);

// Catch and forward
try {
  // ...
} catch (err) {
  if (err instanceof AppError) throw err;
  throw new AppError('INTERNAL', err.message, 500);
}
```

### Frontend
```javascript
// Always show user feedback
try {
  const res = await fetch('/api/...');
  if (!res.ok) {
    const err = await res.json();
    showToast(err.message || 'Error occurred', 'error');
    return;
  }
  showToast('Success!', 'success');
} catch (err) {
  showToast('Network error', 'error');
}
```
