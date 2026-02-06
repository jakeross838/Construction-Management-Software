# Ross Built Construction Management Software

## CRITICAL RULES

### Server Management - ALWAYS RUN IN BACKGROUND
**NEVER run `npm start` or `npm run dev` in the foreground. This kills Claude Code session.**

```bash
# CORRECT - Always use run_in_background parameter
Bash tool with: run_in_background: true

# WRONG - Running server in foreground kills Claude
npm start  (without run_in_background)
```

**To start the server:**
```
Tool: Bash
Parameters:
  command: cd "P:/Claude Projects/Construction Management Software" && npm start
  run_in_background: true
```

**To restart the server:**
```bash
npm run stop && npm start  # with run_in_background: true
```

---

## Quick Reference

| Setting | Value |
|---------|-------|
| **Local Path** | `P:\Claude Projects\Construction Management Software` |
| **GitHub** | https://github.com/jakeross838/Construction-Management-Software |
| **Server URL** | http://localhost:3001 |
| **Supabase** | https://sorghqcpeamdfbvysafj.supabase.co |

### Start Commands
```bash
npm start           # Start server (port 3001)
npm run dev         # Development with hot reload
npm run migrate     # Run database migrations
npm test            # Run tests
```

---

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS (Vite)
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **AI**: Claude (Anthropic API) for invoice processing
- **Storage**: Supabase Storage (PDFs)

---

## Feature Documentation

Detailed documentation for each feature is in `docs/features/`:

| Feature | Status | Documentation |
|---------|--------|---------------|
| **Invoices** | Stable | [docs/features/invoices/](docs/features/invoices/) |
| **Purchase Orders** | Stable | [docs/features/purchase-orders/](docs/features/purchase-orders/) |
| **Draws** | Stable | [docs/features/draws/](docs/features/draws/) |
| **Jobs** | Stable | [docs/features/jobs/](docs/features/jobs/) |
| **Budget** | Stable | [docs/features/budget/](docs/features/budget/) |
| **Estimates** | Stable | [docs/features/estimates/](docs/features/estimates/) |

---

## Project Structure

```
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── pages/          # Page components
│       ├── components/     # Feature components
│       ├── hooks/          # Custom hooks
│       └── types/          # TypeScript types
├── server/                 # Express backend
│   ├── routes/             # API endpoints
│   ├── services/           # Business logic
│   ├── ai/                 # AI processing
│   └── middleware/         # Express middleware
├── database/               # SQL migrations
├── docs/                   # Documentation
│   ├── features/           # Per-feature docs
│   ├── development/        # Dev guides
│   └── archive/            # Historical docs
└── .planning/              # Project planning
```

---

## Database Schema (v2_ prefix)

Core tables:
- `v2_jobs` - Projects
- `v2_vendors` - Vendor directory
- `v2_cost_codes` - CSI cost codes
- `v2_invoices` - Invoice records
- `v2_invoice_allocations` - Cost allocations
- `v2_purchase_orders` - PO records
- `v2_po_line_items` - PO line items
- `v2_draws` - Pay applications
- `v2_budget_lines` - Budget per cost code

See feature docs for detailed schemas.

---

## Development Workflow

### Before Writing Code
1. **Understand** the request
2. **Explore** the codebase (use Glob/Grep/Task agents)
3. **Verify** the schema exists before writing queries

### While Writing Code
4. **Implement** incrementally
5. **Test** each change

### Before Saying Done
6. **Verify**: Server starts, API tested, UI loads, full data flow works
7. **Integration check**: New code is imported/rendered/called

---

## Key Patterns

### Modal Pattern
```javascript
// OPEN - must add .show class
modal.style.display = 'flex';
modal.classList.add('show');

// CLOSE
modal.classList.remove('show');
modal.style.display = 'none';
```

### API Caching
```javascript
const jobs = await window.APICache?.fetch('/api/jobs')
  || await fetch('/api/jobs').then(r => r.json());
```

### Input Debouncing
```javascript
let debounceTimer;
input.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => handleSearch(e.target.value), 150);
});
```

---

## Invoice Status Flow

```
Upload → [received] → [needs_approval] → [approved] → [in_draw] → [paid]
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Modal not visible | Add `modal.classList.add('show')` |
| API 404 | Check route order in server/index.js |
| Server restart | `npm run stop && npm start` |

---

## Additional Resources

- **Development Guide**: `docs/development/STYLE_GUIDE.md`
- **Docker Setup**: `docs/deployment/DOCKER.md`
- **Planning**: `.planning/MASTER_PLAN.md`
- **Archived Docs**: `docs/archive/`

---

## MCP Servers

Configured in `.mcp.json`:
- **Supabase** - Database operations
- **Chrome DevTools** - Browser debugging

---

*For detailed feature documentation, see `docs/features/`*
