# Schedule

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Construction schedule management with Gantt charts, task dependencies, critical path analysis, and baseline tracking. Supports multiple views (calendar, list, Gantt) and schedule templates.

## Key Files

### Frontend
- `client/src/pages/Schedule.tsx` - Main schedule page
- `client/src/components/schedule/` - Components
  - `ScheduleCalendarView.tsx` - Calendar view
  - `ScheduleListView.tsx` - List view
  - `ScheduleGanttView.tsx` - Gantt chart (37KB)
  - `ScheduleTaskDialog.tsx` - Task dialog
  - `ScheduleFilters.tsx` - Filtering
  - `ScheduleColorLegend.tsx` - Status colors
  - `GanttChart.tsx` - Gantt utility

### Backend
- `server/routes/schedules.js` - Schedule API (1645 lines)

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_schedules` | Master schedule records |
| `v2_schedule_tasks` | Individual tasks |
| `v2_schedule_dependencies` | Task dependencies (FS/SS/FF/SF) |
| `v2_schedule_milestones` | Milestone tracking |
| `v2_schedule_templates` | Reusable templates |
| `v2_schedule_activity` | Audit trail |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedules/` | List all schedules |
| GET | `/api/schedules/by-job/:jobId` | Schedule for job |
| POST | `/api/schedules/tasks` | Create task |
| PATCH | `/api/schedules/tasks/:taskId` | Update task |
| POST | `/api/schedules/:id/set-baseline` | Capture baseline |
| GET | `/api/schedules/:id/variance` | Schedule variance |
| GET | `/api/schedules/:id/critical-path` | Critical path analysis |
| GET | `/api/schedules/:id/gantt-enhanced` | Gantt with critical path |
| POST | `/api/schedules/:scheduleId/dependencies` | Add dependency |
| GET | `/api/schedules/templates` | List templates |
| POST | `/api/schedules/templates/from-schedule` | Save as template |
| GET | `/api/schedules/:id/export-pdf` | Export to PDF |

## Task Dependencies
- `FS` - Finish to Start
- `SS` - Start to Start
- `FF` - Finish to Finish
- `SF` - Start to Finish

## Key Features
- Multiple views (Calendar, List, Gantt)
- Task dependencies with lag days
- Critical path analysis
- Baseline tracking & variance
- Milestone management
- Schedule templates
- PDF export

## Related Features
- [Tasks](../tasks/) - Task management
- [Daily Logs](../daily-logs/) - Progress tracking
- [Jobs](../jobs/) - Schedules belong to jobs
