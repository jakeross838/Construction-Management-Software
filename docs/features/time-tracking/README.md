# Time Tracking

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Employee time tracking and timesheet management. Supports clock in/out, job allocation, and integrates with payroll and job costing.

## Key Files

### Frontend
- `client/src/pages/TimeTracking.tsx` - Time tracking page
- `client/src/pages/mobile/MobileTimeClock.tsx` - Mobile clock
- `client/src/components/time-tracking/` - Components

### Backend
- `server/routes/time-tracking.js` - Time tracking API
- `server/routes/timesheets.js` - Timesheets API
- `server/routes/mobile/timeclock.js` - Mobile API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_time_entries` | Time clock entries |
| `v2_timesheets` | Weekly timesheets |
| `v2_timesheet_entries` | Timesheet line items |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/time-tracking` | List time entries |
| POST | `/api/time-tracking/clock-in` | Clock in |
| POST | `/api/time-tracking/clock-out` | Clock out |
| GET | `/api/timesheets` | List timesheets |
| POST | `/api/timesheets` | Create timesheet |
| PATCH | `/api/timesheets/:id` | Update timesheet |
| POST | `/api/timesheets/:id/submit` | Submit for approval |
| POST | `/api/timesheets/:id/approve` | Approve timesheet |

## Entry Status
- `active` - Currently clocked in
- `completed` - Clocked out
- `pending_approval` - Awaiting approval
- `approved` - Approved
- `rejected` - Rejected

## Key Features
- Clock in/out
- Job allocation
- GPS location capture
- Break tracking
- Overtime calculation
- Timesheet approval
- Mobile support
- Payroll export

## Related Features
- [Employees](../employees/) - Employee profiles
- [Jobs](../jobs/) - Job allocation
- [Daily Logs](../daily-logs/) - Crew time logging
