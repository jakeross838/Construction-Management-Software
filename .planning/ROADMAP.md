# Roadmap: Ross Built CMS

## Milestones

- 🔧 **v1.1** - Phases 1-11 (gaps + new features)

---

## Phases 1-6: Gap Fixes

### Phase 1: Foundation Polish
**Goal**: Harden error handling and add missing infrastructure
**Requirements**: FND-01, FND-04
**Status**: Not started
**Success Criteria:**
  1. Consistent error handling across all routes
  2. Request validation middleware on critical endpoints
  3. Centralized error logging

Plans:
- [ ] 01-01: Error handling standardization

---

### Phase 2: Jobs Completion
**Goal**: Complete Job CRUD and profile functionality
**Requirements**: JOB-01, JOB-02, JOB-04
**Status**: Not started
**Success Criteria:**
  1. Full Job CRUD (create, update, delete routes)
  2. Job status transitions with audit trail
  3. Job profile page with metrics dashboard

Plans:
- [ ] 02-01: Job CRUD API routes
- [ ] 02-02: Job profile page enhancements

---

### Phase 3: Vendors Completion
**Goal**: Complete vendor management including documents and duplicate handling
**Requirements**: VND-01, VND-02, VND-03
**Status**: Not started
**Success Criteria:**
  1. Vendor delete, search, and merge functionality
  2. Vendor document management (W-9, insurance, licenses)
  3. Automatic duplicate detection on create

Plans:
- [ ] 03-01: Vendor CRUD completion
- [ ] 03-02: Vendor documents system
- [ ] 03-03: Duplicate detection enhancement

---

### Phase 4: Budget Enhancements
**Goal**: Improve budget visualization and add forecasting
**Requirements**: BUD-04
**Status**: Not started
**Success Criteria:**
  1. Budget vs actuals visual comparison
  2. Variance alerts for overruns
  3. Basic forecasting based on trends

Plans:
- [ ] 04-01: Budget page UI enhancements

---

### Phase 5: Schedule Improvements
**Goal**: Enhance Gantt visualization and task management
**Requirements**: SCH-03
**Status**: Not started
**Success Criteria:**
  1. Interactive Gantt chart
  2. Drag-and-drop task editing
  3. Critical path highlighting

Plans:
- [ ] 05-01: Gantt chart enhancements

---

### Phase 6: Document Versioning
**Goal**: Add proper version tracking and comparison
**Requirements**: DOC-03
**Status**: Not started
**Success Criteria:**
  1. Version history with diffs
  2. Rollback capability
  3. Change tracking

Plans:
- [ ] 06-01: Document version system

---

## Phases 7-11: New Features

### Phase 7: Bids
**Goal**: Users can collect vendor bids, compare them, and convert to POs
**Requirements**: BID-01, BID-02, BID-03, BID-04, BID-05
**Status**: Not started
**Success Criteria:**
  1. User can create a bid request linked to a job
  2. User can upload bid documents from vendors
  3. User can mark bids as accepted/rejected
  4. User can compare multiple bids side-by-side
  5. User can convert an accepted bid to a Purchase Order

Plans:
- [ ] 07-01: Database schema and API routes
- [ ] 07-02: Frontend page and modals

---

### Phase 8: Estimates
**Goal**: Users can create cost estimates and convert to budgets
**Depends on**: Phase 7 (import from bids)
**Requirements**: EST-01, EST-02, EST-03, EST-04, EST-05
**Status**: Not started
**Success Criteria:**
  1. User can create an estimate for a job
  2. User can add line items by cost code
  3. User can import amounts from accepted bids
  4. User can create new versions of an estimate
  5. User can convert approved estimate to job budget

Plans:
- [ ] 08-01: Database schema and API routes
- [ ] 08-02: Frontend page with line item editing

---

### Phase 9: Photos
**Goal**: Users can document project progress with photos
**Depends on**: Nothing (can run parallel to Phase 8)
**Requirements**: PHO-01, PHO-02, PHO-03, PHO-04
**Status**: Not started
**Success Criteria:**
  1. User can upload photos to a job
  2. User can add caption, location, and category to photos
  3. User can view photos in filterable gallery with lightbox
  4. User can link photos to inspections, punch items, or daily logs

Plans:
- [ ] 09-01: Database schema and API routes
- [ ] 09-02: Frontend gallery and upload UI

---

### Phase 10: Dashboard
**Goal**: Actionable overview with alerts and metrics
**Requirements**: DASH-01, DASH-02
**Status**: Not started
**Success Criteria:**
  1. Real-time metrics display
  2. Alert cards for pending items
  3. Quick action buttons

Plans:
- [ ] 10-01: Dashboard metrics and alerts

---

### Phase 11: UX Polish
**Goal**: Mobile responsiveness and usability improvements
**Requirements**: UX-02, UX-03
**Status**: Not started
**Success Criteria:**
  1. Mobile-responsive layouts
  2. Global search functionality
  3. Keyboard shortcuts

Plans:
- [ ] 11-01: Mobile responsiveness
- [ ] 11-02: Global search

---

## Progress

**Execution Order:**
Option A (Fix gaps first): 1-6 → 7-11
Option B (New features first): 7-9 → 1-6 → 10-11

**Recommended**: Option B - Ship visible new features (Bids, Estimates, Photos) first, then polish.

| Phase | Name | Plans | Status | Priority |
|-------|------|-------|--------|----------|
| 1 | Foundation Polish | 0/1 | Not started | P2 |
| 2 | Jobs Completion | 0/2 | Not started | P1 |
| 3 | Vendors Completion | 0/3 | Not started | P1 |
| 4 | Budget Enhancements | 0/1 | Not started | P2 |
| 5 | Schedule Improvements | 0/1 | Not started | P2 |
| 6 | Document Versioning | 0/1 | Not started | P2 |
| 7 | Bids | 0/2 | Not started | **P0** |
| 8 | Estimates | 0/2 | Not started | **P0** |
| 9 | Photos | 0/2 | Not started | **P0** |
| 10 | Dashboard | 0/1 | Not started | P2 |
| 11 | UX Polish | 0/2 | Not started | P2 |

**Priority Legend:**
- P0: New features (ship first)
- P1: Important gaps
- P2: Polish and enhancements

---

## What's Already Complete

These features are fully implemented and need no further work:

1. **Invoices** (100%) - AI extraction, OCR, workflow, stamping, splits, credits
2. **Purchase Orders** (100%) - CRUD, line items, approval, change orders, attachments
3. **Draws** (100%) - G702/G703, Excel/PDF export, workflow
4. **Daily Logs** (100%) - Crew, weather, work summary, photos
5. **Inspections** (100%) - Types, status, deficiencies, photos, re-inspections
6. **Punch Lists** (100%) - Items, workflow, photos, retainage, PO blocking
7. **Cost Codes** (100%) - Master list, categories, picker component
8. **Real-time** (100%) - SSE, offline queue, connection status
