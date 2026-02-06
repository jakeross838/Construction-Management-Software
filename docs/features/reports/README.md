# Reports

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Comprehensive reporting system for construction business analytics. Provides standard reports, custom report builder, and scheduled report delivery.

## Key Files

### Frontend
- `client/src/pages/Reports.tsx` - Main reports page
- `client/src/components/reports/` - Report components

### Backend
- `server/routes/reports.js` - Reports API
- `server/routes/scheduled-reports.js` - Scheduling API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_report_definitions` | Report configurations |
| `v2_scheduled_reports` | Scheduled deliveries |
| `v2_report_history` | Generated reports |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports` | List report types |
| GET | `/api/reports/:type` | Generate report |
| POST | `/api/reports/custom` | Custom report |
| GET | `/api/reports/scheduled` | List schedules |
| POST | `/api/reports/scheduled` | Create schedule |
| GET | `/api/reports/:id/export` | Export report |

## Standard Reports
- **Job Reports**: Job status, progress, cost
- **Financial Reports**: P&L, AR aging, AP aging
- **Budget Reports**: Budget vs actual, variance
- **Production Reports**: Schedule, labor, productivity
- **Vendor Reports**: Spend, insurance status
- **Safety Reports**: Incidents, compliance

## Export Formats
- PDF
- Excel (XLSX)
- CSV

## Key Features
- Standard report library
- Custom report builder
- Date range filters
- Job/vendor filters
- Scheduled delivery
- Email distribution
- Export options

## Related Features
- [Dashboard](../dashboard/) - Quick metrics
- [P&L Dashboard](../pnl-dashboard/) - Financial
- [Profitability](../profitability/) - Job profit
