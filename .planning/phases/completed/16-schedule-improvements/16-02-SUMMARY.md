# Summary 16-02: Critical Path Highlighting

## Completed: 2026-01-18

## What Was Done

Implemented critical path calculation and visual highlighting in the Gantt chart. Users can now see which tasks are on the critical path (zero slack - any delay impacts project end date).

### 1. Critical Path Algorithm (schedule.js)

Added `calculateCriticalPath(tasks)` function implementing the standard forward/backward pass algorithm:

- **Forward Pass**: Calculates Earliest Start (ES) and Earliest Finish (EF) for each task
- **Backward Pass**: Calculates Latest Start (LS) and Latest Finish (LF) from project end
- **Slack Calculation**: Slack = LS - ES
- **Critical Path Identification**: Tasks with slack = 0 (within tolerance of 0.001)
- **Circular Dependency Protection**: Tracks visited nodes to prevent infinite loops

Key features:
- Builds task dependency graph from `depends_on` array
- Calculates duration from `planned_duration_days` or date difference
- Stores metrics (ES, EF, LS, LF, slack) in state for potential future use

### 2. Gantt View Critical Path Styling

Updated rendering functions to display critical path:

- `renderGantt()`: Calculates critical path and stores in state
- `renderGanttRows()`: Passes critical path info to each row
- `renderGanttRow()`: Applies `.critical-path` class and adds "Critical" badge to task labels

Visual indicators in Gantt:
- Red border (2px solid) on critical path bars
- Red glow effect (box-shadow)
- "Critical" badge next to task name in label column
- Left border highlight on row
- Tooltip shows "CRITICAL PATH - Zero slack"

### 3. List View Critical Path Indicator

Updated list view rendering:

- `renderTaskList()`: Calculates critical path for all tasks
- `renderTaskRow()`: Applies `.critical-path` class for styling

Visual indicators in List:
- Red left border (3px) on critical path rows
- "CRITICAL" badge appears after task name via CSS `::after` pseudo-element

### 4. CSS Styling (styles.css)

Added comprehensive critical path styling:

```css
/* Gantt bar styling with red border and glow */
.gantt-bar-*.critical-path {
  border: 2px solid var(--accent-red);
  box-shadow: 0 0 8px rgba(220, 38, 38, 0.4);
}

/* Critical badge for task labels */
.critical-badge {
  background: rgba(220, 38, 38, 0.2);
  color: var(--accent-red);
  /* ... */
}

/* List view row indicator */
.task-row.critical-path {
  border-left: 3px solid var(--accent-red);
}

/* Toggle switch styling */
.toggle-switch { /* ... */ }
```

### 5. Toggle Control (schedule.html + schedule.js)

Added toggle to show/hide critical path highlighting:

- HTML toggle switch in header-actions area
- `toggleCriticalPath()` function updates state and re-renders
- Toggle visibility syncs with schedule display state
- Default state: enabled (checked)

## Files Modified

| File | Changes |
|------|---------|
| `public/js/schedule.js` | Added state properties, calculateCriticalPath function, toggleCriticalPath function, updated renderGantt/renderGanttRows/renderGanttRow, updated renderTaskList/renderTaskRow, updated showSchedule/hideAllStates |
| `public/css/styles.css` | Added ~90 lines of critical path styling (gantt bars, badges, list rows, toggle switch) |
| `public/schedule.html` | Added critical path toggle control in header |

## Testing Verification

- [x] Critical path calculated correctly from task dependencies
- [x] Critical tasks show red border/glow in Gantt view
- [x] Critical badge appears next to task names
- [x] List view shows critical path indicator
- [x] Toggle control shows/hides critical path styling
- [x] Changing task dates recalculates critical path
- [x] Tasks with no dependencies handled correctly
- [x] Circular dependency protection works (no infinite loops)

## Algorithm Details

The critical path method (CPM) implementation:

1. **Build dependency graph**: Map task IDs to their dependents (reverse of depends_on)
2. **Forward pass**:
   - Tasks with no dependencies start at day 0
   - ES = max(EF of all dependencies)
   - EF = ES + duration
3. **Backward pass**:
   - Tasks with no dependents end at project end
   - LF = min(LS of all dependents)
   - LS = LF - duration
4. **Identify critical path**: All tasks where |slack| < 0.001

This matches the standard CPM algorithm used in project management software.
