# Employees

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Employee and crew management for construction companies. Tracks employee information, roles, certifications, and integrates with time tracking.

## Key Files

### Frontend
- `client/src/pages/Employees.tsx` - Main employees page
- `client/src/components/employees/` - Components

### Backend
- `server/routes/employees.js` - Employees API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_employees` | Employee records |
| `v2_employee_certifications` | Certifications |
| `v2_employee_documents` | HR documents |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List employees |
| POST | `/api/employees` | Create employee |
| GET | `/api/employees/:id` | Get employee details |
| PATCH | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Archive employee |
| GET | `/api/employees/:id/time` | Time entries |
| GET | `/api/employees/active` | Active employees only |

## Employee Status
- `active` - Currently employed
- `inactive` - Temporarily inactive
- `terminated` - No longer employed

## Role Types
- `superintendent` - Site supervisor
- `foreman` - Crew leader
- `carpenter` - Skilled trade
- `laborer` - General labor
- `office` - Office staff
- `estimator` - Estimating role
- `project_manager` - PM role

## Key Features
- Employee profiles
- Contact information
- Role assignment
- Pay rate tracking
- Certification tracking
- Document storage
- Time tracking integration

## Related Features
- [Time Tracking](../time-tracking/) - Employee hours
- [Tasks](../tasks/) - Task assignment
- [Daily Logs](../daily-logs/) - Crew logging
