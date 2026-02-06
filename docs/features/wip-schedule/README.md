# WIP Schedule (Work-in-Progress)

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Construction accounting WIP schedule for revenue recognition. Tracks billings vs costs, calculates over/under billing positions, and supports percentage-of-completion accounting.

## Key Files

### Frontend
- `client/src/pages/WIPSchedule.tsx` - Main WIP page
- `client/src/components/wip/` - Components

### Backend
- `server/routes/wip.js` - WIP API

## Database Tables/Views

| Table | Purpose |
|-------|---------|
| `v2_wip_current` | Current WIP positions (view) |
| `v2_wip_summary` | Aggregate WIP summary (view) |
| `v2_wip_snapshots` | Historical snapshots |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wip/current` | Current WIP all jobs |
| GET | `/api/wip/summary` | Summary totals |
| GET | `/api/wip/dashboard` | Dashboard data |
| GET | `/api/wip/:jobId` | Job WIP details |
| POST | `/api/wip/snapshot` | Create period snapshot |

## WIP Calculations
- `contract_value` - Total contract amount
- `costs_to_date` - Total costs incurred
- `billings_to_date` - Total billed
- `percent_complete` - Cost-based completion %
- `earned_revenue` - Contract x % complete
- `over_under_billing` - Billings minus earned

## Key Features
- Over/under billing analysis
- Percentage of completion tracking
- Period snapshots
- Job-by-job breakdown
- Summary dashboard
- Trend visualization

## Related Features
- [Draws](../draws/) - Billing/draw requests
- [Budget](../budget/) - Cost tracking
- [Profitability](../profitability/) - Margin analysis
