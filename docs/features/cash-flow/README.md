# Cash Flow

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Cash flow forecasting and management for construction projects. Tracks incoming payments from draws, outgoing payments to vendors, and provides weekly/monthly cash projections with position analysis.

## Key Files

### Frontend
- `client/src/pages/CashFlow.tsx` - Main cash flow page

### Backend
- `server/routes/cash-flow.js` - Cash flow API routes

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_cash_position_current` | Current cash position summary |
| `v2_upcoming_payments` | Payment obligations and due dates |
| `v2_expected_receipts` | Pending draw funding |
| `v2_cash_flow_forecasts` | Weekly/monthly projections |
| `v2_cash_flow_entries` | Individual transactions |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cash-flow/dashboard` | Summary with payments, receipts, forecast |
| GET | `/api/cash-flow/position` | Current cash position as of date |
| GET | `/api/cash-flow/forecast/weekly` | 12-week cash forecast |
| POST | `/api/cash-flow/forecast/generate` | Generate new forecast |
| GET | `/api/cash-flow/payments/upcoming` | Payments grouped by urgency |
| GET | `/api/cash-flow/receipts/expected` | Expected receipts from draws |
| GET | `/api/cash-flow/reports/by-job` | Inflows/outflows per job |
| GET | `/api/cash-flow/reports/trend` | Historical trend analysis |

## UI Components

- Summary cards (Total Receivables, Payables, Net Position, Due This Week)
- Tabs: Overview, Payments, Receipts, By-Job
- Charts: Weekly forecast (bars + line), Position summary
- Tables: Payments, Receipts, Job breakdown with progress bars

## Related Features
- [Draws](../draws/) - Draw funding is primary inflow
- [Invoices](../invoices/) - Invoice payments are primary outflow
- [PnL Dashboard](../pnl-dashboard/) - Profitability context
