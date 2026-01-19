# Roadmap: Ross Built CMS v1.6

## Overview

Module Expansion milestone adding Leads/CRM for sales pipeline management, Selections/Allowances for tracking client choices and allowance budgets, scaffold pages for future modules, and navigation reorganization.

## Phases

**Phase Numbering:**
- Continues from v1.5 (phases 30-36)
- v1.6 phases: 37-42

- [ ] **Phase 37: Leads Database & API** - Schema and endpoints for lead management
- [ ] **Phase 38: Leads Frontend** - Lead list, pipeline view, and detail modal
- [ ] **Phase 39: Selections Database & API** - Schema and endpoints for selections/allowances
- [ ] **Phase 40: Selections Frontend** - Allowance tracking, variance, and approval UI
- [ ] **Phase 41: Scaffold Modules** - 7 placeholder pages with basic routes
- [ ] **Phase 42: Navigation Reorganization** - Sidebar groups and page routing

## Phase Details

### Phase 37: Leads Database & API
**Goal**: Database schema and API endpoints for lead management
**Depends on**: Nothing (first phase of v1.6)
**Requirements**: LED-01, LED-02, LED-03, LED-05, LED-06, LED-07, LED-08, LED-09, LED-10, LED-11, LED-12
**Success Criteria** (what must be TRUE):
  1. Lead can be created with contact info, project info, and source
  2. Lead can move through pipeline stages with history tracked
  3. Lead tasks can be created with due dates
  4. Lead activities can be logged (calls, emails, meetings)
  5. Lead can be converted to Job or marked Lost
  6. Lead documents can be uploaded
**Research**: Unlikely (follows existing patterns from jobs/vendors)
**Plans**: TBD

Plans:
- [ ] 37-01: Lead database schema and migrations
- [ ] 37-02: Lead CRUD API endpoints
- [ ] 37-03: Lead tasks, activities, and documents API

### Phase 38: Leads Frontend
**Goal**: Lead list page with pipeline view and detail modal
**Depends on**: Phase 37
**Requirements**: LED-04
**Success Criteria** (what must be TRUE):
  1. User can view all leads in a filterable list
  2. User can click a lead to see full details in modal
  3. User can drag leads between pipeline stages (or use dropdown)
  4. User can add/complete tasks from the modal
  5. User can log activities from the modal
  6. User can convert lead to job from the modal
**Research**: Unlikely (follows existing page patterns)
**Plans**: TBD

Plans:
- [ ] 38-01: Leads HTML page and list view
- [ ] 38-02: Lead detail modal with tabs
- [ ] 38-03: Pipeline view and stage management

### Phase 39: Selections Database & API
**Goal**: Database schema and API endpoints for selections and allowances
**Depends on**: Nothing (can parallel with 37-38)
**Requirements**: SEL-01, SEL-02, SEL-03, SEL-04, SEL-05, SEL-06, SEL-07, SEL-10
**Success Criteria** (what must be TRUE):
  1. Selection categories can be created and managed
  2. Allowance budgets can be set per job per category
  3. Selection options catalog can be populated
  4. Client selections can be recorded with pricing
  5. Selection status can be tracked through workflow
  6. Change orders can be created from overages
**Research**: Unlikely (follows existing patterns)
**Plans**: TBD

Plans:
- [ ] 39-01: Selection/allowance database schema and migrations
- [ ] 39-02: Categories and allowances API
- [ ] 39-03: Selections and change orders API

### Phase 40: Selections Frontend
**Goal**: Selections page with allowance tracking and variance display
**Depends on**: Phase 39
**Requirements**: SEL-08, SEL-09, SEL-11, SEL-12
**Success Criteria** (what must be TRUE):
  1. User can view all allowances for a job with over/under variance
  2. User can see cumulative variance across all allowances
  3. User can add selections to an allowance
  4. User can approve selections
  5. User can export selections to PDF
  6. User can create change order from overage
**Research**: Unlikely (follows existing page patterns)
**Plans**: TBD

Plans:
- [ ] 40-01: Selections HTML page and allowance list
- [ ] 40-02: Selection modal and approval workflow
- [ ] 40-03: Variance tracking and PDF export

### Phase 41: Scaffold Modules
**Goal**: Placeholder pages for future modules
**Depends on**: Nothing (independent)
**Requirements**: SCF-01, SCF-02, SCF-03, SCF-04, SCF-05, SCF-06, SCF-07
**Success Criteria** (what must be TRUE):
  1. RFIs page exists with "coming soon" content
  2. Submittals page exists with "coming soon" content
  3. Tasks page exists with "coming soon" content
  4. Messaging page exists with "coming soon" content
  5. Notifications page exists with "coming soon" content
  6. Warranties page exists with "coming soon" content
  7. Closeout page exists with "coming soon" content
**Research**: Unlikely (simple placeholder pages)
**Plans**: TBD

Plans:
- [ ] 41-01: Field module scaffolds (RFIs, Submittals, Tasks)
- [ ] 41-02: Communication scaffolds (Messaging, Notifications)
- [ ] 41-03: Closeout scaffolds (Warranties, Closeout)

### Phase 42: Navigation Reorganization
**Goal**: Reorganize sidebar into logical groups
**Depends on**: Phases 38, 40, 41 (all new pages must exist)
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. Sidebar shows grouped navigation (Sales, Pre-Con, Execution, Field, Finance, Admin, Comms)
  2. New pages (Leads, Selections, scaffolds) appear in correct groups
  3. Existing pages are accessible from new locations
  4. Active page highlighting works correctly
  5. Mobile hamburger menu works with groups
**Research**: Unlikely (CSS and JS updates to existing sidebar)
**Plans**: TBD

Plans:
- [ ] 42-01: Sidebar HTML restructure with groups
- [ ] 42-02: Sidebar JS and mobile menu updates

## Progress

**Execution Order:**
Phases 37-42 execute sequentially, with 37-38 (Leads) and 39-40 (Selections) potentially parallelizable.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 37. Leads Database & API | 0/3 | Not started | - |
| 38. Leads Frontend | 0/3 | Not started | - |
| 39. Selections Database & API | 0/3 | Not started | - |
| 40. Selections Frontend | 0/3 | Not started | - |
| 41. Scaffold Modules | 0/3 | Not started | - |
| 42. Navigation Reorganization | 0/2 | Not started | - |

---
*Roadmap created: 2026-01-18*
*Milestone: v1.6 Module Expansion*
