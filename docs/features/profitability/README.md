# Profitability

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Real-time job profitability calculations and analysis. Tracks gross and net margins, compares budget vs actual, and provides profitability rankings across projects.

## Key Files

### Frontend
- `client/src/pages/Profitability.tsx` - Main profitability page
- `client/src/components/profitability/` - Components

### Backend
- `server/routes/profitability.js` - Profitability API

## Database Tables/Views

| Table | Purpose |
|-------|---------|
| `v2_job_profitability_current` | Current job profitability (view) |
| `v2_job_profitability_ranking` | Profitability rankings (view) |
| `v2_profitability_snapshots` | Historical snapshots |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profitability/summary` | All jobs profitability |
| GET | `/api/profitability/ranking` | Job rankings |
| GET | `/api/profitability/:jobId` | Single job profitability |
| GET | `/api/profitability/:jobId/history` | Historical trends |
| POST | `/api/profitability/snapshot` | Create snapshot |

## Metrics Calculated
- `total_contract` - Contract value
- `total_cost` - Actual costs incurred
- `gross_profit` - Revenue minus direct costs
- `net_profit` - Gross profit minus overhead
- `gross_margin` - Gross profit percentage
- `net_margin` - Net profit percentage

## Key Features
- Real-time margin calculations
- Job-by-job comparison
- Historical snapshots
- Trend analysis
- Profit/loss indicators
- Budget vs actual tracking

## Related Features
- [Budget](../budget/) - Budget tracking
- [Jobs](../jobs/) - Job details
- [WIP Schedule](../wip-schedule/) - Revenue recognition
