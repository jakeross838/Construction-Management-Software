# P&L Dashboard

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Profit and Loss dashboard providing company-wide financial overview. Aggregates revenue, costs, and expenses across all jobs with period-over-period comparison.

## Key Files

### Frontend
- `client/src/pages/PnLDashboard.tsx` - Main P&L dashboard
- `client/src/components/pnl/` - Components

### Backend
- `server/routes/pnl.js` - P&L API

## Database Tables/Views

| Table | Purpose |
|-------|---------|
| `v2_pnl_summary` | P&L summary view |
| `v2_financial_periods` | Accounting periods |
| `v2_pnl_snapshots` | Historical snapshots |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pnl/summary` | Current P&L summary |
| GET | `/api/pnl/by-period` | Period breakdown |
| GET | `/api/pnl/trends` | Historical trends |
| GET | `/api/pnl/by-job` | Job-level P&L |
| POST | `/api/pnl/snapshot` | Create snapshot |

## P&L Line Items
- **Revenue**: Contract values, change orders, draws
- **Direct Costs**: Labor, materials, subcontractors
- **Gross Profit**: Revenue minus direct costs
- **Overhead**: Office, equipment, insurance
- **Net Profit**: Gross profit minus overhead

## Key Features
- Company-wide financial view
- Period comparison
- Job-level drill-down
- Trend visualization
- Snapshot history
- Export to accounting

## Related Features
- [Profitability](../profitability/) - Job profitability
- [Budget](../budget/) - Budget tracking
- [Expenses](../expenses/) - Overhead tracking
