# Change Orders

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Change order management for scope modifications on construction projects. Tracks additive and deductive changes, approval workflows, revision history, and integration with draws for billing.

## Key Files

### Frontend
- `client/src/pages/ChangeOrders.tsx` - Main change orders page
- `client/src/components/change-orders/` - Components
  - `COFormDialog.tsx` - Create/edit form
  - `CODetailPanel.tsx` - Detail view

### Backend
- `server/routes/change-orders.js` - Change order API routes

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_job_change_orders` | Main change order records |
| `v2_job_co_draw_billings` | CO amounts billed in each draw |
| `v2_job_co_activity` | Change order activity log |
| `v2_change_order_invoices` | Invoices linked to COs |
| `v2_change_order_cost_codes` | Cost code allocation |
| `v2_change_order_revisions` | Historical revisions |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/change-orders` | List with filters |
| GET | `/api/change-orders/:id` | Single CO with billing history |
| PATCH | `/api/change-orders/:id` | Update CO details |
| POST | `/api/change-orders/:id/submit` | Submit for approval |
| POST | `/api/change-orders/:id/approve` | Internal approval |
| POST | `/api/change-orders/:id/client-approve` | Client approval |
| POST | `/api/change-orders/:id/link-invoice` | Link invoice to CO |
| GET | `/api/change-orders/:id/revisions` | Revision history |
| POST | `/api/change-orders/:id/revisions` | Create snapshot |

## Status Flow
```
draft → pending_approval → approved
                        → rejected
```

## CO Types
- `scope_change` - Scope modification
- `additive` - Additional work
- `deductive` - Credit/reduction
- `time` - Schedule impact
- `material` - Material changes
- `labor` - Labor adjustments

## Related Features
- [Jobs](../jobs/) - COs belong to jobs
- [Draws](../draws/) - COs billed through draws
- [Invoices](../invoices/) - Invoices linked to COs
- [Budget](../budget/) - COs affect budget
