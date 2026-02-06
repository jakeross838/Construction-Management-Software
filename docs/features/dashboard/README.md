# Dashboard

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Main application dashboard providing company-wide overview. Displays key metrics, recent activity, upcoming items, and quick access to important data.

## Key Files

### Frontend
- `client/src/pages/Dashboard.tsx` - Main dashboard page
- `client/src/components/dashboard/` - Dashboard widgets

### Backend
- `server/routes/dashboard.js` - Dashboard API
- `server/routes/executive-dashboard.js` - Executive metrics

## Database Tables/Views

| Table | Purpose |
|-------|---------|
| `v2_dashboard_metrics` | Cached metrics |
| Various views | Aggregated data |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/metrics` | Key metrics |
| GET | `/api/dashboard/activity` | Recent activity |
| GET | `/api/dashboard/upcoming` | Upcoming items |
| GET | `/api/dashboard/alerts` | System alerts |
| GET | `/api/executive/summary` | Executive summary |

## Dashboard Widgets
- **Job Summary**: Active jobs, stages, progress
- **Financial Overview**: Revenue, costs, margins
- **Cash Position**: AR/AP balances, forecast
- **Activity Feed**: Recent actions
- **Upcoming Items**: Due dates, deadlines
- **Alerts**: Items needing attention

## Key Features
- Customizable widgets
- Real-time metrics
- Activity timeline
- Quick actions
- Alert notifications
- Data visualization
- Role-based views

## Related Features
- [Jobs](../jobs/) - Job details
- [P&L Dashboard](../pnl-dashboard/) - Financial detail
- [Reports](../reports/) - Detailed reports
