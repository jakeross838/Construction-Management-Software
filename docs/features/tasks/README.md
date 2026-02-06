# Tasks

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Task and to-do management for construction projects. Supports task assignment, priority levels, due dates, checklists, and job association.

## Key Files

### Frontend
- `client/src/pages/Tasks.tsx` - Main tasks page
- `client/src/components/tasks/` - Components

### Backend
- `server/routes/tasks.js` - Tasks API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_tasks` | Task records |
| `v2_task_comments` | Task comments |
| `v2_task_attachments` | Task attachments |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks with filters |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task details |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/:id/comments` | Add comment |
| GET | `/api/tasks/stats` | Task statistics |

## Status Values
- `pending` - Not started
- `in_progress` - Currently working
- `completed` - Done
- `cancelled` - Cancelled

## Priority Levels
- `low` - Low priority
- `medium` - Medium priority
- `high` - High priority
- `urgent` - Urgent attention needed

## Key Features
- Job association
- User assignment
- Due date tracking
- Priority levels
- Task comments
- File attachments
- Subtasks support
- Filter and search

## Related Features
- [Jobs](../jobs/) - Job tasks
- [Schedule](../schedule/) - Scheduled items
- [Daily Logs](../daily-logs/) - Daily task logging
