---
phase: 102-schedule-ui-overhaul
plan: 03
subsystem: schedule-ui
tags: [baseline, templates, variance, schedule-management]

dependency-graph:
  requires: ["102-01", "102-02"]
  provides: ["baseline-ui", "template-ui", "variance-display"]
  affects: ["schedule-workflow", "user-productivity"]

tech-stack:
  patterns: ["modal-pattern", "api-integration", "color-coded-variance"]

key-files:
  created: []
  modified:
    - public/schedule.html
    - public/js/schedule.js
    - public/css/styles.css

decisions:
  - key: "variance-in-task-cell"
    value: "Display variance badge inline with task name instead of separate column"
    rationale: "Cleaner UI, works in both list and gantt views"
  - key: "template-preview"
    value: "Show task count, duration, estimated end date in preview"
    rationale: "Helps users understand template scope before applying"

metrics:
  duration: 25min
  completed: 2026-01-21
---

# Phase 102 Plan 03: Baseline and Template UI Summary

**One-liner:** Baseline controls with variance display + template save/apply workflow for schedule management

## What Was Delivered

### Baseline Functionality
1. **Set Baseline Button** - Captures current planned dates as baseline
2. **Show Baseline Toggle** - Shows/hides variance information
3. **Baseline Info Badge** - Displays when baseline was set
4. **Variance Display** - Color-coded badges showing days ahead/behind:
   - Green: On Track or ahead
   - Red: Behind schedule

### Template Management
1. **Save as Template** - Save current schedule as reusable template with:
   - Template name
   - Description
   - Project type (residential/commercial/renovation)

2. **Apply Template** - Create new schedule from template:
   - Template selection dropdown
   - Start date picker
   - Preview showing task count, duration, estimated end

3. **Template Option on Empty State** - "Create from Template" button alongside blank schedule option

## Key Implementation Details

### Files Modified
- `public/schedule.html` - Added baseline modal, save template modal, apply template modal, bulk actions bar
- `public/js/schedule.js` - Added ~300 lines for baseline, template, variance functions
- `public/css/styles.css` - Added ~100 lines for baseline badges, variance colors, template preview

### API Integrations
- `POST /api/schedules/:id/set-baseline` - Set baseline
- `GET /api/schedules/:id/baseline` - Get baseline data
- `GET /api/schedules/templates` - List available templates
- `POST /api/schedules/templates/from-schedule` - Save as template
- `POST /api/schedules/templates/:id/apply` - Apply template to job

### State Additions
```javascript
state.hasBaseline: false,
state.showBaseline: false,
state.baselineData: null,
state.templates: []
```

## Deviations from Plan

None - plan executed as written.

## Verification

- [x] Set Baseline button appears in schedule header
- [x] Show Baseline toggle works
- [x] Baseline info badge displays after setting
- [x] Variance badges show days ahead/behind
- [x] Save as Template modal functions
- [x] Apply Template modal lists templates
- [x] Template preview shows relevant info
- [x] All modals follow existing opacity transition pattern

## Commit

- `b5d8081` - feat(102-03): add baseline and template UI for schedule
