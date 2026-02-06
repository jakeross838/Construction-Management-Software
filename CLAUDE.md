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

### Financial Management
| Feature | Documentation |
|---------|---------------|
| **Invoices** | [docs/features/invoices/](docs/features/invoices/) |
| **Purchase Orders** | [docs/features/purchase-orders/](docs/features/purchase-orders/) |
| **Draws** | [docs/features/draws/](docs/features/draws/) |
| **Budget** | [docs/features/budget/](docs/features/budget/) |
| **Estimates** | [docs/features/estimates/](docs/features/estimates/) |
| **Cash Flow** | [docs/features/cash-flow/](docs/features/cash-flow/) |
| **Change Orders** | [docs/features/change-orders/](docs/features/change-orders/) |
| **Expenses** | [docs/features/expenses/](docs/features/expenses/) |
| **Profitability** | [docs/features/profitability/](docs/features/profitability/) |
| **WIP Schedule** | [docs/features/wip-schedule/](docs/features/wip-schedule/) |
| **Lien Releases** | [docs/features/lien-releases/](docs/features/lien-releases/) |
| **P&L Dashboard** | [docs/features/pnl-dashboard/](docs/features/pnl-dashboard/) |

### Project Management
| Feature | Documentation |
|---------|---------------|
| **Jobs** | [docs/features/jobs/](docs/features/jobs/) |
| **Schedule** | [docs/features/schedule/](docs/features/schedule/) |
| **Tasks** | [docs/features/tasks/](docs/features/tasks/) |
| **Daily Logs** | [docs/features/daily-logs/](docs/features/daily-logs/) |
| **Inspections** | [docs/features/inspections/](docs/features/inspections/) |
| **Punch Lists** | [docs/features/punch-lists/](docs/features/punch-lists/) |
| **Permits** | [docs/features/permits/](docs/features/permits/) |
| **RFIs** | [docs/features/rfis/](docs/features/rfis/) |

### Documents & Files
| Feature | Documentation |
|---------|---------------|
| **Photos** | [docs/features/photos/](docs/features/photos/) |
| **Files** | [docs/features/files/](docs/features/files/) |
| **Plans** | [docs/features/plans/](docs/features/plans/) |
| **Submittals** | [docs/features/submittals/](docs/features/submittals/) |
| **Final Docs** | [docs/features/final-docs/](docs/features/final-docs/) |

### Pre-Construction
| Feature | Documentation |
|---------|---------------|
| **Leads** | [docs/features/leads/](docs/features/leads/) |
| **Bids** | [docs/features/bids/](docs/features/bids/) |
| **Proposals** | [docs/features/proposals/](docs/features/proposals/) |
| **Contracts** | [docs/features/contracts/](docs/features/contracts/) |
| **Selections** | [docs/features/selections/](docs/features/selections/) |

### Contacts & Resources
| Feature | Documentation |
|---------|---------------|
| **Vendors** | [docs/features/vendors/](docs/features/vendors/) |
| **Clients** | [docs/features/clients/](docs/features/clients/) |
| **Employees** | [docs/features/employees/](docs/features/employees/) |

### Admin & Settings
| Feature | Documentation |
|---------|---------------|
| **Dashboard** | [docs/features/dashboard/](docs/features/dashboard/) |
| **Reports** | [docs/features/reports/](docs/features/reports/) |
| **Cost Codes** | [docs/features/cost-codes/](docs/features/cost-codes/) |
| **Time Tracking** | [docs/features/time-tracking/](docs/features/time-tracking/) |
| **Settings** | [docs/features/settings/](docs/features/settings/) |
| **Warranties** | [docs/features/warranties/](docs/features/warranties/) |
| **Business Planning** | [docs/features/business-planning/](docs/features/business-planning/) |
| **Pricing** | [docs/features/pricing/](docs/features/pricing/) |

### Style Guide
| Resource | Location |
|----------|----------|
| **UI/Styling Guide** | [docs/UI_STYLE_GUIDE.md](docs/UI_STYLE_GUIDE.md) |

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

## Multi-Computer Workflow

When working across multiple computers:

```cmd
# Starting work (always sync first)
npm run sync
npm start

# Ending work (push before switching)
npm run push
```

See [docs/MULTI_COMPUTER_WORKFLOW.md](docs/MULTI_COMPUTER_WORKFLOW.md) for detailed instructions.

---

## Additional Resources

- **Development Guide**: `docs/development/STYLE_GUIDE.md`
- **Docker Setup**: `docs/deployment/DOCKER.md`
- **Multi-Computer Workflow**: `docs/MULTI_COMPUTER_WORKFLOW.md`
- **Planning**: `.planning/MASTER_PLAN.md`
- **Archived Docs**: `docs/archive/`

---

## MCP Servers

Configured in `.mcp.json`:
- **Supabase** - Database operations
- **Chrome DevTools** - Browser debugging

---

*For detailed feature documentation, see `docs/features/`*
