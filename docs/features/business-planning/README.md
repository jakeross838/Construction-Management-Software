# Business Planning

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Strategic business planning tools for construction companies. Includes capacity planning, revenue forecasting, and goal tracking.

## Key Files

### Frontend
- `client/src/pages/BusinessPlanning.tsx` - Planning page
- `client/src/components/business-planning/` - Components

### Backend
- `server/routes/business-planning.js` - Planning API
- `server/routes/business.js` - Business metrics API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_business_goals` | Annual/quarterly goals |
| `v2_capacity_forecast` | Capacity projections |
| `v2_revenue_forecast` | Revenue forecasts |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/business-planning/goals` | Get goals |
| POST | `/api/business-planning/goals` | Set goals |
| GET | `/api/business-planning/capacity` | Capacity forecast |
| GET | `/api/business-planning/revenue` | Revenue forecast |
| GET | `/api/business/metrics` | Business metrics |
| GET | `/api/business/trends` | Historical trends |

## Planning Features
- **Revenue Goals**: Annual/quarterly targets
- **Capacity Planning**: Resource availability
- **Pipeline Forecast**: Lead to job conversion
- **Cash Flow Projection**: Future cash needs
- **Backlog Analysis**: Work in queue

## Key Features
- Goal setting
- Progress tracking
- Capacity visualization
- Revenue forecasting
- Trend analysis
- What-if scenarios
- Performance benchmarks

## Related Features
- [Dashboard](../dashboard/) - Current metrics
- [Leads](../leads/) - Pipeline data
- [P&L Dashboard](../pnl-dashboard/) - Financial metrics
