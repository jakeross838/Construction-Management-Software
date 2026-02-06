# Summary 16-01: Interactive Gantt with Drag-and-Drop

## Completed

Implemented drag-and-drop task rescheduling for the Gantt chart. Users can now drag task bars horizontally to change planned dates, with immediate persistence to the database.

## Changes Made

### 1. `public/js/schedule.js`

**Added drag state management:**
- New `dragState` object to track active drag operations (taskId, startX, originalLeft, barElement, dayWidth, minDate)

**Added drag event handlers:**
- `initDragHandlers()` - Attaches mousedown/mousemove/mouseup listeners to gantt body
- `handleDragStart()` - Captures initial position, calculates day width from header cells, adds dragging class
- `handleDragMove()` - Updates bar position as mouse moves, shows tooltip with preview date
- `handleDragEnd()` - Calculates new dates based on final position, calls API to persist

**Added API integration:**
- `updateTaskDates(taskId, startDate, endDate)` - PATCH to `/api/schedules/tasks/:taskId` with new planned_start and planned_end dates

**Added tooltip functions:**
- `showDragTooltip(e, date)` - Creates/positions floating tooltip showing formatted date
- `hideDragTooltip()` - Hides tooltip on drag end

**Modified existing functions:**
- `renderGanttHeader()` - Added `gantt-header-day` class and `data-date` attribute to day cells for date calculation
- `renderGanttRow()` - Added `data-task-id` attribute to bar elements; moved onclick to label-col only to allow bar dragging
- `setView()` - Calls `initDragHandlers()` after rendering Gantt view

### 2. `public/css/styles.css`

**Added drag state styles:**
- Grab cursor on hover for all gantt bar status variants
- Hover effect with subtle lift (translateY -1px) and shadow
- Dragging state with reduced opacity, stronger shadow, and elevated z-index
- `.drag-tooltip` - Fixed position tooltip with dark theme styling

## Technical Details

### Drag-to-Date Calculation
1. On drag start, dayWidth is calculated from header cell positions (defaults to 30px)
2. Minimum date is read from first header cell's `data-date` attribute
3. On drag end, new start date = minDate + (pixelOffset / dayWidth) days
4. End date is calculated by preserving original duration: newEnd = newStart + duration - 1

### API Integration
- Uses existing PATCH `/api/schedules/tasks/:taskId` endpoint
- Sends `planned_start` and `planned_end` in ISO date format (YYYY-MM-DD)
- On success: shows toast notification, reloads schedule to sync state
- On failure: shows error toast, reverts to server state via reload

## Verification Checklist

- [x] Gantt bars show grab cursor on hover
- [x] Mousedown on bar starts drag (bar shows dragging style)
- [x] Mousemove updates bar position horizontally
- [x] Tooltip shows new date during drag
- [x] Mouseup triggers PATCH API call with new dates
- [x] Task dates persist after page refresh
- [x] Toast notification confirms reschedule
- [x] Drag outside container handled gracefully (clamped to 0 minimum)
