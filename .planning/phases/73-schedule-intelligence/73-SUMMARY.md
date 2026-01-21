# Phase 73: Schedule Intelligence - Summary

**Completed:** 2026-01-20
**Migration:** 086

---

## What Was Built

### Database (migration-086-schedule-intelligence.sql)

1. **v2_schedule_templates table**:
   - Standard construction sequences by project type
   - Estimated duration in days
   - Phases as JSON array
   - Default template flag

2. **v2_schedules table**:
   - Links to job
   - Status: draft, active, complete, on_hold
   - Date range: start, target end, actual end
   - Working days configuration (JSON array)
   - Holiday exclusions
   - Schedule health: critical path days, buffer, on_schedule flag

3. **v2_schedule_tasks table**:
   - Task identity: name, description, phase
   - Timing: duration days, start/end dates, actual dates
   - Status: not_started, in_progress, complete, blocked
   - Trade assignment
   - Lead time requirements
   - Is critical path flag
   - Float days calculation

4. **v2_schedule_dependencies table**:
   - Task relationships: predecessor_id, successor_id
   - Dependency type: finish_to_start, start_to_start, finish_to_finish, start_to_finish
   - Lag days for buffers

5. **v2_schedule_milestones table**:
   - Key project milestones
   - Target and actual dates
   - Criticality level

6. **Database functions**:
   - `generate_schedule_from_estimate(estimate_id)` - Create schedule from estimate selections
   - `calculate_critical_path(schedule_id)` - Determine critical path and float
   - `reschedule_task(task_id, new_date)` - Cascade date changes
   - `get_schedule_health(schedule_id)` - Health metrics

---

## API Endpoints

### Schedule CRUD
- `GET /api/jobs/:jobId/schedule` - Get job schedule with tasks
- `POST /api/jobs/:jobId/schedule` - Create schedule
- `POST /api/jobs/:jobId/schedule/generate` - Generate from estimate
- `PATCH /api/schedules/:id` - Update schedule settings

### Tasks
- `POST /api/schedules/:id/tasks` - Add task
- `PATCH /api/schedules/:id/tasks/:taskId` - Update task
- `DELETE /api/schedules/:id/tasks/:taskId` - Remove task
- `PATCH /api/schedules/:id/tasks/:taskId/status` - Update task status

### Dependencies
- `POST /api/schedules/:id/dependencies` - Add dependency
- `DELETE /api/schedules/:id/dependencies/:depId` - Remove dependency

### Analysis
- `GET /api/schedules/:id/critical-path` - Get critical path tasks
- `GET /api/schedules/:id/health` - Get schedule health metrics
- `POST /api/schedules/:id/recalculate` - Recalculate all dates

---

## UI Features

### Gantt Chart View

Using Frappe Gantt library:
- Visual timeline of all tasks
- Drag to adjust dates
- Click to edit task details
- Critical path highlighted in red
- Dependencies shown as arrows
- Milestones as diamonds

### Schedule Generator

From estimate:
1. Groups line items by trade
2. Applies catalog dependencies
3. Factors in lead times
4. Calculates durations from labor hours + crew size
5. Sequences by dependency type
6. Identifies critical path

### Health Dashboard

- Days to completion
- Tasks on track / behind / ahead
- Critical path risk indicators
- Lead time warnings
- Inspection scheduling

---

## Key Algorithms

### Critical Path Calculation

1. Forward pass: Calculate earliest start/finish
2. Backward pass: Calculate latest start/finish
3. Float = Latest Start - Earliest Start
4. Critical path = Tasks with 0 float

### Lead Time Handling

- Items with `lead_time_days > 0` auto-scheduled early
- Warning if item ordered after required date
- Links to PO creation for procurement

### Cure Time & Inspections

- Concrete cure time (3-7 days typical)
- Paint dry time between coats
- Inspection holds inserted automatically

---

## Notes

Schedule Intelligence enables:
1. Generate realistic schedules from selections
2. Automatic dependency sequencing
3. Critical path visibility
4. Lead time procurement alerts
5. What-if analysis for date changes
