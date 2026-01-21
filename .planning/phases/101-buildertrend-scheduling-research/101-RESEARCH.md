# Phase 101: Buildertrend Scheduling Research

**Researched:** 2026-01-21
**Domain:** Construction scheduling software competitive analysis
**Confidence:** MEDIUM (WebSearch-based, Buildertrend blocks direct doc access)

## Summary

This research documents Buildertrend's scheduling implementation as a reference for improving Ross Built's scheduling features. Buildertrend is the industry standard for residential construction scheduling, targeting builders with $500K+ annual volume.

Key findings reveal significant gaps between our current implementation and Buildertrend's mature feature set, particularly in: baseline schedules for planned vs. actual comparison, schedule templates for recurring job types, multi-view options beyond list/Gantt, trade/vendor assignment workflows with notifications, and client visibility controls.

**Primary recommendation:** Prioritize implementing baseline schedules and schedule templates as these provide the highest immediate value for project managers tracking schedule variance and onboarding new jobs.

## Buildertrend Schedule UI Patterns

### Multiple View Options
Buildertrend provides **8 distinct schedule views** to accommodate different user needs:

| View | Purpose | Key Features |
|------|---------|--------------|
| **Gantt** | Visual timeline with dependencies | Drag-drop bars, dependency arrows, critical path highlighting |
| **List** | Sequential task listing | Sortable columns, quick status updates |
| **Agenda** | Filtered by assignee | Shows tasks assigned to specific user |
| **Month** | Calendar overview | Quick date selection, visual density |
| **Week** | Mid-level planning | Balance of detail and overview |
| **Day** | Daily operations | Hourly granularity option |
| **Baseline** | Planned vs actual comparison | Static "screenshot" of original plan |
| **Phases List** | Tasks organized by phase | Progress tracking per construction phase |

**Our current implementation:** List and Gantt views only. Missing: Agenda, Calendar views (Month/Week/Day), Baseline, Phases List.

### Schedule Item Fields
Each Buildertrend schedule item supports:

| Field | Description | Our Support |
|-------|-------------|-------------|
| Title | Task name | YES |
| Assigned Users | Multiple assignees | PARTIAL (single vendor) |
| Progress % | Completion tracking | YES |
| Start Date | Planned start | YES |
| Duration (workdays) | Excludes non-work days | PARTIAL (calendar days only) |
| End Date | Auto-calculated or manual | YES |
| Actual Start/End | As-built tracking | YES |
| Reminders | Notification before start | NO |
| Display Color | Visual organization | NO |
| Phase | Construction phase association | YES |
| Tags | Filtering/categorization | NO |
| Notes | Task details/instructions | YES |
| Attachments | Files linked to task | NO |
| Comments | Collaboration on task | NO |
| Show on Gantt | Toggle visibility | NO |
| Sub/Vendor visibility | Permission control | NO |
| Client visibility | Permission control | NO |

### Task Dependency Types
Buildertrend supports:
- **Finish-to-Start (FS)**: Previous task must complete before next starts (default)
- **Start-to-Start (SS)**: Tasks can begin simultaneously

**Our current implementation:** Dependencies stored in `depends_on` array, processed via CPM algorithm. Support FS and SS via `dependency_type` field, plus lag days.

## Task Management Features

### Task Creation
Buildertrend task creation includes:
1. Inline quick-add from any view
2. Full modal with all fields
3. Copy/duplicate existing tasks
4. Bulk import from templates

**Our implementation:** Modal-based creation only. Missing: inline quick-add, copy/duplicate, bulk import.

### Task Editing
Buildertrend editing features:
- **Drag-and-drop on Gantt**: Move tasks by dragging bars
- **Resize bars**: Extend/shorten duration by dragging edges
- **Quick status toggle**: One-click status changes in list view
- **Inline editing**: Edit fields without opening modal
- **Cascade updates**: Moving a task automatically adjusts dependent tasks

**Our implementation:** Modal editing, Frappe Gantt drag-drop. Missing: resize bars, inline editing, quick status toggle.

### Bulk Operations
Buildertrend supports:
- Multi-select tasks for bulk status changes
- Bulk reassignment to different vendor
- Bulk date shift (move selected tasks forward/back)
- Bulk delete with dependency handling

**Our implementation:** No bulk operations. Each task must be edited individually.

## Dependency Handling and Critical Path

### Dependency Visualization
Buildertrend displays dependencies as:
- **Arrows on Gantt**: Lines connecting predecessor to successor
- **Dependency type indicators**: Visual distinction between FS and SS
- **Critical path highlighting**: Red/bold styling for critical tasks
- **Float indicators**: Visual representation of task flexibility

**Our implementation:** Frappe Gantt shows arrows. Critical path calculated client-side with highlighting. Float displayed in popup. Missing: visual dependency type distinction.

### Automatic Cascade
When predecessors shift, Buildertrend:
1. Automatically adjusts all successor dates
2. Recalculates critical path
3. Notifies affected assignees
4. Shows "what changed" history

**Our implementation:** Server-side `recalculate_schedule` RPC exists but not auto-triggered on drag. Manual recalculate endpoint available.

### Critical Path Features
Buildertrend critical path:
- Real-time calculation
- Visual highlighting on all views
- Filter to show only critical tasks
- Impact analysis for date changes

**Our implementation:** Client-side CPM calculation. Toggle to show/hide critical path. API endpoint for critical path data. Missing: impact analysis, server-side auto-recalculation.

## Template and Baseline Schedule Features

### Schedule Templates (HIGH VALUE)
Buildertrend templates allow:

| Feature | Description |
|---------|-------------|
| Save as Template | Convert any schedule to reusable template |
| Template Library | Company-wide template storage |
| Default Template | Auto-apply to new jobs of certain type |
| Template Tasks | Include all task details, dependencies, phases |
| Template Durations | Relative durations, not absolute dates |
| Apply Template | Start date anchors, all tasks cascade from there |

**Our implementation:** `v2_schedule_templates` table exists. `generate_schedule_from_selections` RPC creates schedules. Missing: save-as-template UI, template library UI, template management.

### Baseline Schedules (HIGH VALUE)
Buildertrend baseline features:

| Feature | Description |
|---------|-------------|
| Set Baseline | Capture "snapshot" of planned schedule |
| Baseline View | Compare current vs original side-by-side |
| Auto-tracking | Changes automatically show variance |
| Multiple Baselines | Re-baseline at project milestones |
| Variance Report | Summary of delays/acceleration |

How it works:
1. At project kickoff (e.g., permit pull), set baseline
2. Baseline stays constant as reference point
3. As actual dates slip or accelerate, view shows variance
4. Helps identify "where time went" on delayed projects

**Our implementation:** No baseline support. Would require storing original planned dates separately from current planned dates.

## Trade/Vendor Assignment Workflow

### Assignment Features
Buildertrend vendor assignment:
- Assign multiple users to single task
- Filter tasks by assignee (Agenda view)
- Permission levels: view only, view & confirm, edit
- Job access requirement before task assignment
- Real-time availability indicator (June 2025 feature)

**Our implementation:** Single `assigned_vendor_id` per task. No multi-assignment. No permission levels.

### Notification System
Buildertrend notifications:
- **Assignment notification**: When added to task
- **Reminder before start**: Configurable days before
- **Schedule change notification**: When dates move
- **Push, email, SMS**: Multiple channels
- **Customizable frequency**: User-controlled

**Our implementation:** No notification system for schedules.

### Conflict Detection (2025 Feature)
Recent Buildertrend additions:
- Real-time availability indicators in assignee dropdown
- Conflict warning icon (!) for users with overlapping assignments
- Click icon to see all conflicts across jobs
- Configurable max overlap threshold per user

**Our implementation:** No conflict detection.

## Mobile Scheduling Experience

### Mobile Features
Buildertrend mobile app includes:
- All desktop views (Gantt, List, Agenda, Month)
- Full task creation and editing
- Progress updates from field
- Photo/document attachments to tasks
- Push notifications for changes
- Offline mode for schedule viewing

**Our implementation:** Responsive web design (no native app). Basic mobile support via responsive CSS. No offline mode.

### Field-Specific Workflows
Mobile-optimized features:
- Quick progress slider for updates
- Today's tasks quick view
- One-tap "Start Task" / "Complete Task"
- Location-aware check-in (optional)

**Our implementation:** No field-specific workflows.

## Gap Analysis: Our Implementation vs Buildertrend

### Current Implementation Strengths
- Frappe Gantt integration with drag-drop
- Critical path calculation (client-side)
- Dependency management with lag days
- Phase and trade assignment
- PDF export
- Activity logging

### Critical Gaps (Priority 1)

| Gap | Buildertrend | Our Current | Impact |
|-----|--------------|-------------|--------|
| **Baseline Schedules** | Full support with variance tracking | None | Cannot track schedule slippage vs plan |
| **Schedule Templates** | Library with save/apply | DB tables exist, no UI | Manual schedule creation for each job |
| **Notifications** | Push/email/SMS for changes | None | Subcontractors unaware of changes |
| **Bulk Operations** | Multi-select, bulk edit | None | Tedious multi-task updates |

### Important Gaps (Priority 2)

| Gap | Buildertrend | Our Current | Impact |
|-----|--------------|-------------|--------|
| **Calendar Views** | Month/Week/Day views | List and Gantt only | Limited planning perspective |
| **Agenda View** | Filtered by assignee | None | Hard to see "my tasks" |
| **Task Colors** | Color-coded by trade/category | None | Visual organization limited |
| **Tags** | Filterable tags on tasks | None | Cannot group/filter custom categories |
| **Reminders** | Days-before alerts | None | No proactive task awareness |
| **Client Visibility** | Granular permission per task | None | All-or-nothing visibility |

### Nice-to-Have Gaps (Priority 3)

| Gap | Buildertrend | Our Current | Impact |
|-----|--------------|-------------|--------|
| **Conflict Detection** | Real-time overlap warnings | None | Double-booking possible |
| **Task Attachments** | Files/photos per task | None | Documents live elsewhere |
| **Task Comments** | Threaded discussion | None | Communication outside system |
| **Inline Editing** | Edit without modal | Modal only | Extra clicks for quick changes |
| **Workday Calculation** | Excludes weekends/holidays | Calendar days | Durations may be inaccurate |

## Implementation Recommendations

### Phase 1: Foundation (High Value, Moderate Effort)
1. **Baseline Schedules**
   - Add `baseline_start`, `baseline_end` to v2_schedule_tasks
   - Add "Set Baseline" action to schedule header
   - Add baseline view showing planned vs baseline variance
   - Show variance in task list/popup

2. **Schedule Templates UI**
   - Template list page with create/edit/delete
   - "Save as Template" button on schedule
   - "Apply Template" when creating schedule
   - Template preview before applying

### Phase 2: Collaboration (High Value for Subs)
3. **Notification System**
   - Task assignment notifications (email first)
   - Schedule change notifications
   - Reminder X days before start
   - Notification preferences per user

4. **Bulk Operations**
   - Multi-select checkboxes in list view
   - Bulk status change
   - Bulk date shift
   - Bulk reassignment

### Phase 3: Views (Better UX)
5. **Calendar Views**
   - Month view showing tasks on calendar
   - Week view for near-term planning
   - Day view for daily operations

6. **Agenda View**
   - Filter tasks by assigned vendor
   - "My Tasks" quick filter
   - Today's tasks prominent

### Phase 4: Polish
7. **Task Colors and Tags**
   - Color picker for tasks
   - Auto-color by trade option
   - Custom tags with filter support

8. **Conflict Detection**
   - Check vendor availability on assignment
   - Show conflicts across jobs
   - Warning before overbooking

## Architecture Patterns

### Baseline Schedule Pattern
```javascript
// Database: Add baseline fields to v2_schedule_tasks
baseline_start DATE,
baseline_end DATE,
baseline_set_at TIMESTAMPTZ

// API: Set baseline for all tasks
POST /api/schedules/:id/set-baseline
  - Copy planned_start/planned_end to baseline_start/baseline_end for all tasks
  - Set baseline_set_at timestamp on schedule

// UI: Show variance
const variance = daysDiff(task.planned_end, task.baseline_end);
// Positive = behind schedule, Negative = ahead
```

### Template Pattern
```javascript
// Save as template
POST /api/schedules/templates
{
  name: "Custom Home - 6 Month",
  source_schedule_id: "...",  // Copy structure from existing
  description: "Standard custom home build"
}
// Server copies all tasks with relative day offsets (Day 1, Day 15, etc.)

// Apply template
POST /api/schedules/:id/apply-template
{
  template_id: "...",
  start_date: "2026-02-01"  // Anchor date
}
// Server creates tasks with dates calculated from anchor
```

### Notification Pattern
```javascript
// Notification triggers
1. Task assigned to vendor -> notify vendor
2. Task date changed -> notify assigned vendor
3. Task approaching (X days) -> reminder notification
4. Dependency cascade -> notify all affected vendors

// Notification preferences (per user)
{
  email_assignment: true,
  email_changes: true,
  reminder_days: 2,
  push_enabled: false
}
```

## Common Pitfalls

### Pitfall 1: Baseline Overwrite
**What goes wrong:** Accidentally reset baseline, losing original plan reference
**How to avoid:** Require confirmation, allow multiple baselines, audit log

### Pitfall 2: Template Drift
**What goes wrong:** Templates become outdated as best practices evolve
**How to avoid:** Template versioning, "update from schedule" feature, last-used date tracking

### Pitfall 3: Notification Fatigue
**What goes wrong:** Too many notifications cause users to ignore them
**How to avoid:** Smart batching, digest emails, user-controlled frequency

### Pitfall 4: Cascade Confusion
**What goes wrong:** Dragging one task causes unexpected downstream changes
**How to avoid:** Preview cascade before applying, undo support, highlight affected tasks

## Code Examples

### Baseline Variance Display
```javascript
// Source: Buildertrend pattern
function getVarianceClass(task) {
  if (!task.baseline_end || !task.planned_end) return '';
  const variance = daysDiff(task.planned_end, task.baseline_end);
  if (variance > 7) return 'variance-critical';  // Red: >7 days behind
  if (variance > 0) return 'variance-warning';   // Yellow: behind
  if (variance < 0) return 'variance-ahead';     // Green: ahead
  return '';
}
```

### Template Application
```javascript
// Source: Buildertrend pattern
async function applyTemplate(scheduleId, templateId, startDate) {
  // Get template tasks (sorted by relative day)
  const templateTasks = await getTemplateTasks(templateId);

  // Calculate absolute dates from anchor
  const anchor = new Date(startDate);
  for (const task of templateTasks) {
    task.planned_start = addDays(anchor, task.relative_start_day);
    task.planned_end = addDays(anchor, task.relative_end_day);
    await createTask(scheduleId, task);
  }

  // Apply dependencies
  await copyTemplateDependencies(templateId, scheduleId);

  // Recalculate critical path
  await recalculateSchedule(scheduleId);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static Gantt export | Interactive drag-drop Gantt | 2020-2022 | Real-time schedule manipulation |
| Manual dependency tracking | Auto-cascade on change | 2021-2023 | Reduced manual recalculation |
| Single schedule view | Multi-view (8+ options) | 2023-2024 | Different perspectives for different roles |
| Email-only notifications | Push + Email + SMS | 2024-2025 | Real-time field awareness |
| Manual conflict detection | Auto availability check | June 2025 | Prevent double-booking |

## Open Questions

1. **Workday Calculation**
   - How does Buildertrend handle weekends/holidays in duration?
   - Do they have a configurable work calendar?
   - Recommendation: Consider `work_days` config on schedule level

2. **Multiple Baselines**
   - Can you set multiple baselines (e.g., at each milestone)?
   - Recommendation: Start with single baseline, extend later

3. **Permission Granularity**
   - Exact permission model for sub visibility?
   - Recommendation: Research CoConstruct (now merged with Buildertrend) for detailed permissions

## Sources

### Primary (MEDIUM confidence - WebSearch verified)
- [Buildertrend Scheduling Software](https://buildertrend.com/project-management/schedule/) - Main features page
- [Schedule on Mobile](https://buildertrend.com/help-article/schedule-on-mobile/) - Mobile feature documentation
- [June 2025 Product Improvements](https://buildertrend.com/help-article/june-2025-current-product-improvements/) - Recent updates

### Secondary (MEDIUM confidence - Multiple sources)
- [Connecteam Buildertrend Review 2026](https://connecteam.com/reviews/buildertrend/) - Detailed feature analysis
- [Construction Schedule Guide](https://buildertrend.com/blog/construction-scheduling-guide/) - Best practices
- [Critical Path in Construction](https://buildertrend.com/blog/critical-path-method-construction/) - CPM implementation

### Tertiary (LOW confidence - WebSearch only)
- Various comparison articles and user reviews
- Podcast transcripts for feature details
- Note: Buildertrend blocks direct documentation access (403 errors)

## Metadata

**Confidence breakdown:**
- Schedule UI patterns: MEDIUM - Multiple consistent sources
- Task management features: MEDIUM - Help articles referenced
- Templates/Baselines: MEDIUM - Blog and podcast sources
- Mobile features: MEDIUM - App store and help articles
- Gap analysis: HIGH - Based on code review of our implementation

**Research date:** 2026-01-21
**Valid until:** 2026-04-21 (90 days - Buildertrend updates frequently)
