---
phase: 104-application-reorganization
plan: 02
subsystem: sidebar
tags: [sidebar, context-awareness, job-filter, company-pages]

dependency-graph:
  requires: [104-01-detectPageContext-api]
  provides: [context-aware-sidebar, graceful-api-degradation]
  affects: [all-pages, job-filtering]

tech-stack:
  added: []
  patterns: [context-detection, graceful-degradation]

key-files:
  created: []
  modified:
    - public/js/sidebar.js

decisions:
  - id: sidebar-context-check
    choice: Check context in init() before injection
    reason: Single point of control, early exit
  - id: api-degradation
    choice: Return empty/null on company pages instead of error
    reason: Prevents script errors on company pages

metrics:
  duration: 5 min
  completed: 2026-01-21
---

# Phase 104 Plan 02: Job Sidebar Context Awareness Summary

**One-liner:** Context-aware sidebar that only appears on job-context pages with graceful API degradation

## What Was Built

Made sidebar.js context-aware:

1. **COMPANY_CONTEXT_PAGES array** - Local copy for independence from NavSidebar
2. **getPageContext() function** - Detects job vs company context:
   - Checks data-page-context attribute first
   - Falls back to NavSidebar.detectPageContext() if available
   - Falls back to local URL matching
3. **Context check in init()** - Skips sidebar injection on company pages
4. **Graceful API degradation**:
   - onJobChange() - Calls with ('', null) on company pages
   - getSelectedJobId() - Returns '' on company pages
   - getSelectedJob() - Returns null on company pages

## Key Changes

```javascript
function init() {
  if (SidebarState.isInitialized) return;

  // Check if this page should have job sidebar
  const pageContext = getPageContext();
  if (pageContext !== 'job') {
    console.log('[Sidebar] Company context page - sidebar disabled');
    SidebarState.isInitialized = true;
    return;  // Early exit - no sidebar injection
  }
  // ... rest of init
}
```

## Verification

- Job-context pages (index.html, draws.html) show job sidebar
- Company-context pages (catalog.html, employees.html) do NOT show sidebar
- Company pages have full-width content
- JobSidebar API calls don't error on company pages
- Console shows "[Sidebar] Company context page - sidebar disabled"

## Deviations from Plan

None - plan executed exactly as written.

## Commits

- c28a52a: feat(104-02): add context-aware sidebar injection

## Next Phase Readiness

Sidebar now respects page context. Company pages have full-width layout.
