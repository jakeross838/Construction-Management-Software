# Phase 100: Gantt Scheduling - Research

**Researched:** 2026-01-21
**Domain:** Interactive Gantt Charts for Construction Project Scheduling
**Confidence:** HIGH

## Summary

This research investigates how to implement a functional Gantt chart for construction project scheduling with interactive drag-drop, task dependencies visualization, critical path highlighting, resource allocation display, and export capabilities.

The project already has a robust database schema (migration-086) with full CPM support including forward/backward pass calculations, four dependency types (FS/FF/SS/SF), lag times, and working day calculations. The existing schedule.html page shows a basic Gantt view, but a dedicated library will provide better interactivity.

**Primary recommendation:** Use **Frappe Gantt** as the visualization library (per roadmap), implement custom critical path highlighting via CSS classes using existing database CPM calculations, and leverage pdfmake (already installed) for server-side PDF export with html-to-image for image exports.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| frappe-gantt | Latest (CDN) | Interactive Gantt chart rendering | Zero dependencies, vanilla JS, MIT license, beautiful UI, drag-drop built-in |
| pdfmake | 0.3.3 (installed) | Server-side PDF generation | Already used in project for reports |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| html-to-image | Latest | Client-side image export | Export Gantt to PNG for sharing |
| ExcelJS | 4.4.0 (installed) | Excel schedule export | Schedule data export |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Frappe Gantt | DHTMLX Gantt | More features but GPLv2 license, no CPM in free version |
| Frappe Gantt | Custom implementation | Full control but significant development time |
| html-to-image | html2canvas | html-to-image has better font handling, smaller bundle |

**Installation:**
```bash
# Add to HTML via CDN (no npm install needed for frontend)
# CDN links in HTML:
# <script src="https://cdn.jsdelivr.net/npm/frappe-gantt/dist/frappe-gantt.umd.js"></script>
# <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/frappe-gantt/dist/frappe-gantt.css">

# For image export (optional npm install)
npm install html-to-image
```

## Architecture Patterns

### Recommended Project Structure
```
public/
  gantt.html              # New Gantt scheduling page
  js/
    gantt-chart.js        # Gantt initialization and data handling
  css/
    gantt-dark.css        # Dark theme overrides for Frappe Gantt
server/
  routes/
    schedule.js           # Schedule API (may already exist)
database/
  migration-086*.sql      # Existing - has full CPM support
```

### Pattern 1: Data Flow Architecture
**What:** Separate data management (API) from visualization (Frappe Gantt)
**When to use:** Always - keeps state management clean
**Example:**
```javascript
// Source: Project patterns from schedule.html, draws.html

// 1. Load tasks from API
async function loadScheduleTasks(scheduleId) {
  const response = await fetch(`/api/schedules/${scheduleId}/tasks`);
  const data = await response.json();
  return data.tasks.map(task => ({
    id: task.id,
    name: task.name,
    start: task.planned_start,
    end: task.planned_end,
    progress: task.percent_complete,
    dependencies: task.dependencies.map(d => d.predecessor_id).join(', '),
    custom_class: task.is_critical ? 'critical-task' : ''
  }));
}

// 2. Initialize Frappe Gantt
const gantt = new Gantt('#gantt', tasks, {
  view_mode: 'Week',
  on_date_change: (task, start, end) => updateTaskDates(task.id, start, end),
  on_progress_change: (task, progress) => updateTaskProgress(task.id, progress),
  on_click: (task) => openTaskModal(task.id)
});

// 3. Persist changes via API
async function updateTaskDates(taskId, start, end) {
  await fetch(`/api/schedule-tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planned_start: start, planned_end: end })
  });
  // Trigger recalculation on backend
  await fetch(`/api/schedules/${scheduleId}/recalculate`, { method: 'POST' });
}
```

### Pattern 2: Critical Path Visualization
**What:** Highlight critical path tasks using CSS classes
**When to use:** When displaying CPM results from database
**Example:**
```javascript
// Database already calculates is_critical via migration-086
// Apply custom_class to critical tasks for Frappe Gantt

const tasks = dbTasks.map(t => ({
  ...formatTask(t),
  custom_class: t.is_critical ? 'bar-critical' : ''
}));

// CSS in gantt-dark.css:
// .gantt .bar-critical .bar { fill: #ef4444 !important; }
// .gantt .bar-critical .bar-progress { fill: #dc2626 !important; }
```

### Pattern 3: Dependency Arrows
**What:** Use Frappe Gantt's built-in dependency visualization
**When to use:** Always - dependencies are core to scheduling
**Example:**
```javascript
// Frappe Gantt expects dependencies as comma-separated predecessor IDs
const tasks = dbTasks.map(t => ({
  id: t.id,
  name: t.name,
  start: t.planned_start,
  end: t.planned_end,
  progress: t.percent_complete || 0,
  // Convert array of predecessor IDs to Frappe format
  dependencies: t.predecessors?.join(', ') || ''
}));
```

### Pattern 4: Resource Allocation Display
**What:** Show assigned vendor/crew in task name or popup
**When to use:** When resource visibility is needed
**Example:**
```javascript
// Frappe Gantt doesn't have built-in resource rows
// Option 1: Include in task name
const taskName = task.assigned_vendor
  ? `${task.name} (${task.assigned_vendor})`
  : task.name;

// Option 2: Custom popup
const gantt = new Gantt('#gantt', tasks, {
  popup: (task) => {
    return {
      title: task.name,
      subtitle: task.assigned_vendor || 'Unassigned',
      details: [
        { label: 'Status', value: task.status },
        { label: 'Crew Size', value: task.crew_size || 1 }
      ]
    };
  }
});
```

### Anti-Patterns to Avoid
- **Client-side CPM calculation:** Database already has robust CPM functions - don't duplicate in JavaScript
- **Direct DOM manipulation for highlights:** Use Frappe Gantt's custom_class system instead
- **Storing Gantt state in memory only:** Always persist to database on change
- **Blocking UI during recalculation:** Use async API calls with loading indicators

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gantt chart rendering | Custom SVG/Canvas | Frappe Gantt | Drag-drop, zooming, dependency arrows are complex |
| Critical path calculation | JavaScript CPM algorithm | Database functions (migration-086) | PostgreSQL functions are tested, handle edge cases |
| Working day calculations | Calendar math in JS | Database `add_working_days()` function | Already handles holidays, weekends |
| Topological sort | Graph algorithm | Database `get_task_order()` function | SQL recursive CTE is efficient |
| PDF export | Client-side jsPDF | Server-side pdfmake | Better formatting control, already in project |
| Date formatting | Manual string building | Native Intl or Gantt's built-in | Localization handled |

**Key insight:** The database layer (migration-086) has sophisticated scheduling logic including forward/backward pass CPM, lag time handling, constraint types, and auto-scheduling. The frontend should be a visualization layer, not a calculation engine.

## Common Pitfalls

### Pitfall 1: SVG Export Issues with html2canvas
**What goes wrong:** Frappe Gantt renders as SVG, html2canvas struggles with SVG elements
**Why it happens:** html2canvas rasterizes DOM but has incomplete SVG support
**How to avoid:** Use html-to-image which handles SVG better, or server-side rendering
**Warning signs:** Blank areas in exported images, missing dependency arrows

### Pitfall 2: Timezone Issues with Dates
**What goes wrong:** Task dates shift by a day when displayed vs stored
**Why it happens:** Date strings interpreted as UTC but displayed in local time
**How to avoid:** Use date-only strings (YYYY-MM-DD) not timestamps, set Frappe Gantt's date_format
**Warning signs:** Tasks appear to start a day earlier/later than expected

### Pitfall 3: Performance with Many Tasks
**What goes wrong:** UI becomes sluggish with 100+ tasks
**Why it happens:** Each task change triggers full re-render
**How to avoid:** Batch updates, debounce API calls, consider pagination
**Warning signs:** Lag when dragging tasks, slow initial load

### Pitfall 4: Circular Dependency Detection
**What goes wrong:** Invalid dependency chains cause infinite loops
**Why it happens:** Database allows insertion before validation
**How to avoid:** Check for cycles before inserting dependencies using existing SQL functions
**Warning signs:** API timeout on schedule recalculation

### Pitfall 5: Forgetting .show Class on Modals
**What goes wrong:** Task edit modal opens but is invisible
**Why it happens:** Project uses opacity:0 with .show class for transitions
**How to avoid:** Follow existing modal pattern from CLAUDE.md
**Warning signs:** Modal backdrop appears but content invisible

### Pitfall 6: Not Preserving Dependencies on Drag
**What goes wrong:** Dragging a task doesn't update dependent tasks
**Why it happens:** Frappe Gantt has move_dependencies option but API recalc needed
**How to avoid:** Call recalculate endpoint after any date change
**Warning signs:** Critical path becomes invalid after manual adjustments

## Code Examples

Verified patterns from official sources and existing codebase:

### Initialize Frappe Gantt with Dark Theme
```javascript
// Source: https://github.com/frappe/gantt, https://github.com/frappe/gantt/issues/376

const gantt = new Gantt('#gantt', tasks, {
  view_mode: 'Week',
  bar_height: 30,
  column_width: 45,
  readonly: false,
  readonly_progress: false,
  move_dependencies: true,
  snap_at: '1d',
  popup_on: 'click',
  date_format: 'YYYY-MM-DD',
  language: 'en',
  on_date_change: handleDateChange,
  on_progress_change: handleProgressChange,
  on_click: handleTaskClick,
  on_view_change: handleViewChange
});

// View mode switching
document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    gantt.change_view_mode(btn.dataset.view); // 'Day', 'Week', 'Month'
  });
});
```

### Dark Theme CSS Override
```css
/* Source: https://github.com/frappe/gantt/issues/376, adapted for project */

.gantt-container {
  background-color: var(--card);
}

.gantt .grid-header {
  fill: var(--card);
  stroke: var(--border);
}

.gantt .grid-row {
  fill: var(--card);
}

.gantt .grid-row:nth-child(even) {
  fill: var(--card-elevated);
}

.gantt .row-line {
  stroke: var(--border);
}

.gantt .tick {
  stroke: var(--border);
}

.gantt .today-highlight {
  fill: var(--accent-blue);
  opacity: 0.1;
}

.gantt .arrow {
  stroke: var(--text-secondary);
}

.gantt .bar {
  fill: var(--card-elevated);
  stroke: none;
}

.gantt .bar-progress {
  fill: var(--accent-blue);
}

/* Critical path highlighting */
.gantt .bar-critical .bar {
  fill: rgba(239, 68, 68, 0.3);
  stroke: var(--danger);
}

.gantt .bar-critical .bar-progress {
  fill: var(--danger);
}

.gantt .bar-label {
  fill: var(--foreground);
}

.gantt .upper-text {
  fill: var(--text-secondary);
}

.gantt .lower-text {
  fill: var(--foreground);
}

/* Popup styling */
.gantt-container .popup-wrapper {
  background-color: var(--card-elevated);
  border: 1px solid var(--border);
}

.gantt-container .popup-wrapper .title {
  border-color: var(--accent-blue);
}

.gantt-container .popup-wrapper .pointer {
  border-top-color: var(--card-elevated);
}
```

### Map Database Tasks to Frappe Format
```javascript
// Source: Existing project patterns

function mapTasksToGantt(dbTasks) {
  return dbTasks.map(task => ({
    id: task.id,
    name: task.name,
    start: task.planned_start, // YYYY-MM-DD format
    end: task.planned_end,
    progress: task.percent_complete || 0,
    // Frappe expects comma-separated predecessor IDs
    dependencies: task.predecessors?.map(p => p.predecessor_id).join(', ') || '',
    // Custom class for critical path highlighting
    custom_class: task.is_critical ? 'bar-critical' : ''
  }));
}
```

### API Handlers for Task Updates
```javascript
// Source: Existing project API patterns (server/routes/reports.js style)

async function handleDateChange(task, newStart, newEnd) {
  try {
    // Update task dates
    await fetch(`/api/schedule-tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planned_start: formatDate(newStart),
        planned_end: formatDate(newEnd)
      })
    });

    // Trigger CPM recalculation (database function)
    await fetch(`/api/schedules/${currentScheduleId}/recalculate`, {
      method: 'POST'
    });

    // Reload to show updated critical path
    await refreshGantt();
    showToast('Schedule updated', 'success');
  } catch (err) {
    console.error('Failed to update task:', err);
    showToast('Failed to update schedule', 'error');
    // Revert Gantt to previous state
    await refreshGantt();
  }
}

function formatDate(date) {
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return date;
}
```

### Export to Image (Client-Side)
```javascript
// Source: html-to-image documentation

import { toPng } from 'html-to-image';

async function exportGanttImage() {
  const ganttContainer = document.querySelector('.gantt-container');

  try {
    const dataUrl = await toPng(ganttContainer, {
      backgroundColor: '#141414', // Match dark theme
      quality: 1,
      pixelRatio: 2 // Higher resolution
    });

    // Download the image
    const link = document.createElement('a');
    link.download = `schedule-${new Date().toISOString().split('T')[0]}.png`;
    link.href = dataUrl;
    link.click();

    showToast('Schedule exported', 'success');
  } catch (err) {
    console.error('Export failed:', err);
    showToast('Export failed', 'error');
  }
}
```

### Server-Side PDF Export
```javascript
// Source: Existing server/routes/reports.js pattern

router.get('/schedules/:id/export/pdf', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get schedule with tasks
  const { data: schedule } = await supabase
    .from('v2_schedules')
    .select(`
      *,
      job:v2_jobs(name),
      tasks:v2_schedule_tasks(*)
    `)
    .eq('id', id)
    .single();

  // Build pdfmake table
  const tableBody = [
    [
      { text: 'Task', style: 'tableHeader' },
      { text: 'Start', style: 'tableHeader' },
      { text: 'End', style: 'tableHeader' },
      { text: 'Duration', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Critical', style: 'tableHeader' }
    ],
    ...schedule.tasks.map(task => [
      task.name,
      task.planned_start || '-',
      task.planned_end || '-',
      `${task.estimated_days} days`,
      task.status,
      task.is_critical ? 'Yes' : 'No'
    ])
  ];

  const docDefinition = {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    content: [
      { text: `${schedule.job.name} - Schedule`, style: 'title' },
      { text: `Critical Path: ${schedule.critical_path_days} days`, style: 'subtitle' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: tableBody
        }
      }
    ],
    styles: {
      title: { fontSize: 18, bold: true },
      subtitle: { fontSize: 12, margin: [0, 0, 0, 10] },
      tableHeader: { bold: true, fillColor: '#D9E1F2' }
    }
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);
  pdfDoc.getBuffer((buffer) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="schedule-${id}.pdf"`);
    res.send(Buffer.from(buffer));
  });
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jQuery Gantt plugins | Vanilla JS libraries (Frappe) | 2020+ | No jQuery dependency, better performance |
| Client-side CPM | Server-side CPM (PostgreSQL) | Current | Better consistency, handles complex cases |
| SVG export via html2canvas | html-to-image or server-side | 2023+ | Better SVG support |
| pdfmake client-side | pdfmake server-side | Current | Consistent fonts, better performance |

**Deprecated/outdated:**
- DHTMLX Gantt free version lacks critical path (PRO feature only)
- jquery.gantt plugins - jQuery dependency, unmaintained
- Client-side CPM calculation when database has robust functions

## Open Questions

Things that couldn't be fully resolved:

1. **Resource grouping/rows in Frappe Gantt**
   - What we know: Frappe Gantt doesn't have built-in resource rows
   - What's unclear: Best UX for showing resource allocation without row grouping
   - Recommendation: Show vendor in task name or popup; consider phase grouping later

2. **Offline support for drag-drop changes**
   - What we know: Project has offline queue pattern (realtime.js)
   - What's unclear: How to queue schedule changes that need CPM recalc
   - Recommendation: Queue optimistically, recalc on reconnect, handle conflicts

3. **Large schedule performance**
   - What we know: Frappe handles typical project sizes well
   - What's unclear: Performance threshold (100? 500? tasks)
   - Recommendation: Implement pagination if needed post-MVP

## Sources

### Primary (HIGH confidence)
- Frappe Gantt GitHub: https://github.com/frappe/gantt - Features, API, events
- Frappe Gantt Docs: https://docs.frappe.io/gantt/introduction - Configuration options
- Project codebase: migration-086-schedule-intelligence.sql - CPM implementation
- Project codebase: server/routes/reports.js - PDF export patterns with pdfmake

### Secondary (MEDIUM confidence)
- Frappe Gantt dark mode CSS: https://github.com/frappe/gantt/issues/376 - Community CSS
- Bryntum Frappe Gantt tutorial: https://bryntum.com/blog/creating-a-gantt-chart-with-frappe-gantt/ - Integration patterns
- LogRocket Frappe Gantt guide: https://blog.logrocket.com/gantt-chart-javascript-frappe-gantt/ - Code examples

### Tertiary (LOW confidence)
- html-to-image vs html2canvas comparisons (multiple blog posts)
- General CPM algorithm descriptions (Wikipedia, GeeksforGeeks)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Frappe Gantt is explicitly mentioned in roadmap, well-documented
- Architecture: HIGH - Database schema already exists with full CPM support
- Pitfalls: MEDIUM - Based on community issues and general Gantt implementation experience
- Export: HIGH - pdfmake already proven in project, html-to-image well-documented

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - Frappe Gantt is stable, infrequent updates)
