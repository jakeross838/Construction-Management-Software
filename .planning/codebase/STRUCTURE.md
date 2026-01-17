# Project Structure

## Root Directory
```
Construction-Management-Software/
├── config/                 # Configuration
├── database/              # SQL migrations
├── public/                # Frontend (static files)
├── server/                # Backend (Express)
├── tests/                 # Playwright E2E tests
├── .planning/             # GSD planning files
├── package.json           # Dependencies & scripts
├── .env                   # Environment variables
└── CLAUDE.md              # Project documentation
```

## Server Directory
```
server/
├── index.js               # Express app entry point
│                          # - Middleware setup
│                          # - Static file serving
│                          # - Route mounting
│                          # - Common endpoints
│
├── routes/                # API route handlers
│   ├── invoices.js        # /api/invoices/*
│   ├── purchase-orders.js # /api/purchase-orders/*
│   ├── draws.js           # /api/draws/*
│   ├── jobs.js            # /api/jobs/*
│   ├── vendors.js         # /api/vendors/*
│   ├── punch-lists.js     # /api/punch-lists/*
│   ├── inspections.js     # /api/inspections/*
│   ├── schedules.js       # /api/schedules/*
│   ├── daily-logs.js      # /api/daily-logs/*
│   ├── documents.js       # /api/documents/*
│   ├── change-orders.js   # /api/change-orders/*
│   ├── cost-codes.js      # /api/cost-codes/*
│   ├── ai.js              # /api/ai/*
│   ├── dashboard.js       # /api/dashboard/*
│   ├── locks.js           # /api/locks/*
│   ├── undo.js            # /api/undo/*
│   └── realtime.js        # /api/sse
│
├── services/              # Shared service logic
│   ├── activityLogger.js  # Activity logging helper
│   └── invoiceHelpers.js  # Invoice utilities
│
├── ai-processor.js        # Invoice AI extraction
├── ai-document-processor.js # Document AI
├── ai-learning.js         # AI learning system
├── ocr-processor.js       # OCR via Claude Vision
├── pdf-stamper.js         # Approval stamps
├── document-converter.js  # PDF to image
├── duplicate-check.js     # Duplicate detection
├── storage.js             # Supabase storage
├── validation.js          # Data validation
├── standards.js           # Naming conventions
├── locking.js             # Entity locking
├── undo.js                # Undo queue
├── realtime.js            # SSE handler
├── errors.js              # AppError class
├── reconciliation.js      # Reconciliation logic
├── migrate.js             # Migration runner
├── stop.js                # Graceful shutdown
└── restamp-invoices.js    # Bulk re-stamp utility
```

## Public Directory
```
public/
├── css/
│   └── styles.css         # Main stylesheet (~7200 lines)
│                          # - CSS variables (theming)
│                          # - Component styles
│                          # - Modal styles
│                          # - Table/grid styles
│
├── js/
│   ├── api-cache.js       # Cached API fetches
│   ├── toasts.js          # Toast notifications
│   ├── nav-sidebar.js     # Navigation sidebar
│   ├── realtime.js        # SSE client
│   ├── validation.js      # Client validation
│   ├── modal-helpers.js   # Modal utilities
│   ├── cost-code-picker.js # Cost code picker component
│   ├── searchable-picker.js # Searchable dropdown
│   ├── sidebar.js         # Sidebar logic
│   │
│   ├── app.js             # Invoice dashboard JS
│   ├── modals.js          # Invoice modal handlers
│   ├── po-app.js          # PO page JS
│   ├── po-modals.js       # PO modal class
│   ├── co-app.js          # Change orders JS
│   ├── daily-logs.js      # Daily logs JS
│   ├── documents.js       # Documents JS
│   ├── inspections.js     # Inspections JS
│   ├── punch-lists.js     # Punch lists JS
│   ├── schedule.js        # Schedule JS
│   └── job-profile.js     # Job profile JS
│
├── index.html             # Invoice dashboard (main)
├── pos.html               # Purchase orders
├── draws.html             # Draws/pay applications
├── budgets.html           # Budget tracking
├── change-orders.html     # Change orders
├── daily-logs.html        # Daily logs
├── documents.html         # Document management
├── inspections.html       # Inspections
├── punch-lists.html       # Punch lists
├── schedule.html          # Project schedule
├── vendors.html           # Vendor management
├── cost-codes.html        # Cost codes
├── job-profile.html       # Job details
├── reconciliation.html    # Reconciliation
├── dashboard.html         # Dashboard
├── bids.html              # Bids (placeholder)
├── estimates.html         # Estimates (placeholder)
├── lien-releases.html     # Lien releases
└── photos.html            # Photos (placeholder)
```

## Database Directory
```
database/
├── schema.sql             # Base schema (v2_ tables)
├── migration-001-*.sql    # PO and enhanced invoices
├── migration-002-*.sql    # Invoice enhancements
├── ...                    # (38 migrations total)
├── migration-038-*.sql    # Punch lists
├── run-migration.js       # Single migration runner
├── setup.js               # Initial setup script
└── seed.js                # Seed data script
```

## Tests Directory
```
tests/
├── *.spec.js              # Playwright test files
├── comprehensive-api-test.js
├── workflow-test.js
├── data-integrity-check.js
└── screenshots/           # Test screenshots
```

## Config Directory
```
config/
└── index.js               # Supabase client setup
                           # Port configuration
```

## Key Files by Purpose

### Entry Points
| File | Purpose |
|------|---------|
| `server/index.js` | Server entry, route mounting |
| `public/index.html` | Main dashboard page |

### Configuration
| File | Purpose |
|------|---------|
| `config/index.js` | Supabase client |
| `.env` | Environment variables |
| `package.json` | Dependencies, scripts |

### Core Business Logic
| File | Purpose |
|------|---------|
| `server/routes/invoices.js` | Invoice workflow |
| `server/routes/purchase-orders.js` | PO management |
| `server/routes/draws.js` | Draw/G702/G703 |
| `server/ai-processor.js` | Invoice AI extraction |

### Shared Utilities
| File | Purpose |
|------|---------|
| `server/errors.js` | AppError class |
| `server/storage.js` | File upload/download |
| `public/js/api-cache.js` | Cached fetches |
| `public/js/toasts.js` | Notifications |

### Styling
| File | Purpose |
|------|---------|
| `public/css/styles.css` | All application styles |
