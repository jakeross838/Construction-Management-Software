# Budget

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Construction budget management per job and cost code. Tracks budgeted amounts vs actuals (committed from POs, billed from invoices, paid). Integrates with draws for G703 Schedule of Values and provides variance detection.

## Key Files

### Frontend
- `client/src/pages/Budget.tsx` - Main budget page
- `client/src/components/budgets/` - 1 component

### Backend
- `server/routes/budgets.js` - Budget API routes
- `server/services/budget-sync.js` - Budget synchronization
- `server/services/variance-detector.js` - Variance detection

### Database Migrations
- `migration-020-budget-closeout.sql` - Closeout tracking
- `migration-043-ai-budget-system.sql` - AI integration
- `migration-064-budget-rpc.sql` - RPC functions
- `migration-128a-cleanup-budgets.sql` - Schema cleanup
- `migration-129-budgets.sql` - Core budget schema
- `migration-135-budget-co-amount.sql` - Change order amounts
- `migration-136-fix-budget-lines-schema.sql` - Schema fixes
- `migration-147-ensure-budget-columns.sql` - Column verification
- `migration-166-budget-revisions.sql` - Revision tracking
- `migration-175-fix-budget-sync-trigger.sql` - Sync triggers
- `migration-179-budget-builder-id.sql` - Builder integration

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_budget_lines` | Budget per job + cost code combination |

### Key Fields (v2_budget_lines)
```sql
id, job_id, cost_code_id,
budgeted_amount,    -- Original budget
committed_amount,   -- PO totals
billed_amount,      -- Invoice totals
paid_amount,        -- Paid invoices
UNIQUE(job_id, cost_code_id)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs/:id/budget` | Get job budget with actuals |
| POST | `/api/budgets` | Create budget line |
| PATCH | `/api/budgets/:id` | Update budget line |
| GET | `/api/budgets/variance` | Get variance report |

## Component Inventory

| Component | Purpose |
|-----------|---------|
| BudgetLineFormDialog.tsx | Create/edit budget line |

## Budget Calculations

### Per Cost Code
```javascript
{
  costCode: "06100 - Rough Carpentry",
  budgeted: 50000,           // From budget_lines.budgeted_amount
  committed: 45000,          // Sum of PO line items
  billed: 35000,             // Sum of invoice allocations
  paid: 30000,               // Sum of paid invoice allocations
  remaining: 15000,          // budgeted - billed
  variance: 5000,            // budgeted - committed
  percentComplete: 70        // billed / budgeted * 100
}
```

### Automatic Updates
Budget amounts update automatically when:
- PO created/updated → `committed_amount`
- Invoice allocated → `billed_amount`
- Invoice paid → `paid_amount`

## Integration with Cost Codes

Uses `v2_cost_codes` for categorization:
```sql
v2_cost_codes
├── code TEXT ("06100")
├── name TEXT ("Rough Carpentry")
└── category TEXT
```

Standard CSI cost code structure for construction.

## Variance Detection
Server monitors for variances:
- Over budget alerts
- Committed exceeds budget warnings
- Cost code trending analysis

## Current Limitations / TODO
- [ ] Budget revision history
- [ ] Multi-currency support

## Related Features
- [Jobs](../jobs/) - Budget belongs to job
- [Invoices](../invoices/) - Allocations update billed_amount
- [Purchase Orders](../purchase-orders/) - POs update committed_amount
- [Draws](../draws/) - G703 uses budget data
- [Estimates](../estimates/) - Estimates can seed budgets
