---
phase: 104
plan: 04
subsystem: frontend
tags: [html, data-attributes, rbac, context-detection]
dependency-graph:
  requires: [104-01, 104-02]
  provides: [company-context-page-classification]
  affects: [future-rbac, sidebar-context-detection]
tech-stack:
  patterns: [data-attributes-for-context, role-minimum-for-rbac]
key-files:
  modified:
    - public/dashboard.html
    - public/business-dashboard.html
    - public/catalog.html
    - public/vendors.html
    - public/cost-codes.html
    - public/employees.html
    - public/crew-schedule.html
    - public/timesheets.html
    - public/companies.html
    - public/contacts.html
    - public/price-intelligence.html
    - public/expenses.html
    - public/financial-periods.html
    - public/overhead.html
    - public/profitability.html
    - public/wip.html
    - public/pnl.html
    - public/cash-flow.html
    - public/business-planning.html
decisions: []
metrics:
  duration: "2 min"
  completed: "2026-01-21"
---

# Phase 104 Plan 04: Company-Context Page Attributes Summary

**One-liner:** Added data-page-context, data-page-id, data-page-group, and data-role-min attributes to all 19 company-context HTML pages for declarative page classification and future RBAC.

## What Was Built

Added data attributes to body tags of all company-context pages:

### Company Finance Pages (8) - group: company-finance
| Page | data-page-id | data-role-min |
|------|--------------|---------------|
| expenses.html | expenses | accounting |
| financial-periods.html | financial-periods | admin |
| overhead.html | overhead | admin |
| profitability.html | profitability | pm |
| wip.html | wip | accounting |
| pnl.html | pnl | admin |
| cash-flow.html | cash-flow | admin |
| business-planning.html | business-planning | admin |

### Resources Pages (4) - group: resources
| Page | data-page-id | data-role-min |
|------|--------------|---------------|
| catalog.html | catalog | pm |
| vendors.html | vendors | pm |
| cost-codes.html | cost-codes | admin |
| price-intelligence.html | price-intelligence | pm |

### Team Pages (5) - group: team
| Page | data-page-id | data-role-min |
|------|--------------|---------------|
| companies.html | companies | pm |
| contacts.html | contacts | pm |
| employees.html | employees | admin |
| crew-schedule.html | crew-schedule | supervisor |
| timesheets.html | timesheets | field_crew |

### Overview Pages (2) - group: overview
| Page | data-page-id | data-role-min |
|------|--------------|---------------|
| dashboard.html | dashboard | pm |
| business-dashboard.html | business-dashboard | pm |

## Technical Approach

Each company-context page body tag now has:
```html
<body data-page-context="company" data-page-id="{id}" data-page-group="{group}" data-role-min="{role}">
```

This enables:
1. **Context Detection**: detectPageContext() reads data-page-context="company"
2. **Sidebar Behavior**: Job sidebar disabled on company-context pages
3. **Page Identification**: data-page-id provides unique identifier
4. **Future RBAC**: data-role-min stores minimum role for access control

## Verification

- Grep for company-context pages: 19 files matched
- All pages have data-page-context="company"
- All pages have unique data-page-id values
- All pages have appropriate data-page-group
- All pages have data-role-min attribute

## Deviations from Plan

None - plan executed exactly as written.

## Wave 2 Complete

With both 104-03 and 104-04 complete:
- Total pages with context attributes: 48 (29 job + 19 company)
- detectPageContext() now has reliable data source
- Foundation ready for future RBAC implementation
