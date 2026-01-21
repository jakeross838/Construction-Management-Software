---
phase: 104
plan: 03
subsystem: frontend
tags: [html, data-attributes, rbac, context-detection]
dependency-graph:
  requires: [104-01, 104-02]
  provides: [job-context-page-classification]
  affects: [future-rbac, sidebar-context-detection]
tech-stack:
  patterns: [data-attributes-for-context, role-minimum-for-rbac]
key-files:
  modified:
    - public/index.html
    - public/draws.html
    - public/pos.html
    - public/change-orders.html
    - public/budgets.html
    - public/lien-releases.html
    - public/job-hub.html
    - public/job-profile.html
    - public/schedule.html
    - public/daily-logs.html
    - public/photos.html
    - public/documents.html
    - public/rfis.html
    - public/submittals.html
    - public/inspections.html
    - public/permits.html
    - public/punch-lists.html
    - public/selections.html
    - public/leads.html
    - public/bids.html
    - public/estimates.html
    - public/contracts.html
    - public/budget-builder.html
    - public/closeout.html
    - public/warranties.html
    - public/reconciliation.html
    - public/correspondence.html
    - public/meetings.html
    - public/compliance.html
decisions: []
metrics:
  duration: "3 min"
  completed: "2026-01-21"
---

# Phase 104 Plan 03: Job-Context Page Attributes Summary

**One-liner:** Added data-page-context, data-page-id, data-page-group, and data-role-min attributes to all 29 job-context HTML pages for declarative page classification and future RBAC.

## What Was Built

Added data attributes to body tags of all job-context pages:

### Finance Pages (6) - group: job-finance
| Page | data-page-id | data-role-min |
|------|--------------|---------------|
| index.html | invoices | accounting |
| draws.html | draws | accounting |
| pos.html | pos | pm |
| change-orders.html | change-orders | pm |
| budgets.html | budgets | accounting |
| lien-releases.html | lien-releases | accounting |

### Pre-Construction Pages (7) - group: precon
| Page | data-page-id | data-role-min |
|------|--------------|---------------|
| leads.html | leads | pm |
| job-profile.html | job-profile | pm |
| bids.html | bids | pm |
| estimates.html | estimates | pm |
| budget-builder.html | budget-builder | pm |
| contracts.html | contracts | pm |
| selections.html | selections | client |

### Active Projects Pages (13) - group: active
| Page | data-page-id | data-role-min |
|------|--------------|---------------|
| job-hub.html | job-hub | field_crew |
| schedule.html | schedule | supervisor |
| daily-logs.html | daily-logs | field_crew |
| photos.html | photos | field_crew |
| documents.html | documents | supervisor |
| rfis.html | rfis | pm |
| submittals.html | submittals | pm |
| inspections.html | inspections | supervisor |
| permits.html | permits | pm |
| punch-lists.html | punch-lists | supervisor |
| correspondence.html | correspondence | pm |
| meetings.html | meetings | pm |
| compliance.html | compliance | pm |

### Closeout Pages (3) - group: closeout
| Page | data-page-id | data-role-min |
|------|--------------|---------------|
| closeout.html | closeout | pm |
| warranties.html | warranties | pm |
| reconciliation.html | reconciliation | accounting |

## Technical Approach

Each job-context page body tag now has:
```html
<body data-page-context="job" data-page-id="{id}" data-page-group="{group}" data-role-min="{role}">
```

This enables:
1. **Context Detection**: detectPageContext() can read data-page-context directly
2. **Page Identification**: data-page-id provides unique identifier
3. **Page Grouping**: data-page-group enables filtering by category
4. **Future RBAC**: data-role-min stores minimum role for access control

## Verification

- Grep for job-context pages: 29 files matched
- All pages have data-page-context="job"
- All pages have unique data-page-id values
- All pages have appropriate data-page-group
- All pages have data-role-min attribute

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for:
- detectPageContext() to read from data attributes (primary method)
- Future RBAC implementation using data-role-min
- Page filtering by group in navigation
