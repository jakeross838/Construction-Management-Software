# Draws (Pay Applications)

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
AIA G702/G703 Pay Application management for construction projects. Draws collect approved invoices for billing to clients/lenders. Generates standard AIA format documents with Schedule of Values, retainage tracking, and Excel/PDF export.

## Key Files

### Frontend
- `client/src/pages/Draws.tsx` - Main draws list page
- `client/src/components/draws/` - 8 components

### Backend
- `server/routes/draws.js` - Draw API routes
- `server/services/reconciliation.js` - Financial reconciliation

### Database Migrations
- `migration-008-draw-workflow-redesign.sql` - Base workflow
- `migration-067-draw-edits.sql` - Edit capabilities
- `migration-127-draw-period-dates.sql` - Period tracking
- `migration-178-fix-duplicate-draw-invoices.sql` - Data integrity

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_draws` | Main draw records (G702 data) |
| `v2_draw_invoices` | Junction: invoices included in draws |

### Key Fields (v2_draws)
```sql
id, job_id, draw_number, period_end, total_amount, funded_amount,
status (draft/submitted/funded), submitted_at, funded_at, created_at
UNIQUE(job_id, draw_number)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/draws` | List all draws |
| GET | `/api/draws/:id` | Get with G702/G703 data |
| POST | `/api/jobs/:id/draws` | Create draw for job |
| POST | `/api/draws/:id/add-invoices` | Add invoices to draw |
| POST | `/api/draws/:id/remove-invoice` | Remove invoice |
| PATCH | `/api/draws/:id/submit` | Submit draw |
| PATCH | `/api/draws/:id/fund` | Mark as funded |
| GET | `/api/draws/:id/export/excel` | Excel export |
| GET | `/api/draws/:id/export/pdf` | PDF export |

## Component Inventory

| Component | Purpose |
|-----------|---------|
| DrawTable.tsx | Main draws list |
| DrawDetailPanel.tsx | Fullscreen draw modal with tabs |
| DrawFormDialog.tsx | Create draw form |
| DrawStats.tsx | Summary statistics |
| DrawBulkActions.tsx | Bulk operations |
| FundDrawDialog.tsx | Record funding modal |
| COInvoicesDialog.tsx | Change order invoices view |
| LienReleaseQuickView.tsx | Related lien releases |

## G702 Calculations (Application for Payment)
```javascript
{
  originalContractSum: job.contract_amount,
  netChangeOrders: sum(approved change orders),
  contractSumToDate: originalContractSum + netChangeOrders,
  totalCompletedToDate: sum(all invoices in previous + current draws),
  totalCompletedThisPeriod: sum(current draw invoices),
  retainagePercent: 10,
  retainageAmount: totalCompletedToDate * 0.10,
  lessPreviousCertificates: sum(previous draws),
  currentPaymentDue: totalCompletedThisPeriod - retainageThisPeriod
}
```

## G703 Calculations (Schedule of Values)
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

## Status Flow
```
Create Draw → [draft]
                 ↓
    Add Invoices
                 ↓
        Submit → [submitted]
                 ↓
     Client Pays → [funded]
```

## Draw Modal Tabs
1. **Summary** - Job, Application #, Period, Invoice count, Payment Due
2. **G702** - AIA Application and Certificate for Payment
3. **G703** - Schedule of Values with budget vs billings
4. **Invoices** - List of invoices with Add/Remove actions

## Current Limitations / TODO
- [ ] Automatic retainage release tracking
- [ ] Integration with accounting systems

## Related Features
- [Invoices](../invoices/) - Invoices added to draws
- [Jobs](../jobs/) - Draws belong to jobs
- [Budget](../budget/) - G703 shows budget vs billings
