# Roadmap: Ross Built CMS v1.1

## Overview

Complete the three remaining field features (Bids, Estimates, Photos) to round out the construction management system. Each phase delivers a fully functional feature following existing codebase patterns.

## Phases

- [ ] **Phase 1: Bids** - Vendor bid collection, comparison, and PO conversion
- [ ] **Phase 2: Estimates** - Cost estimation with version control and budget conversion
- [ ] **Phase 3: Photos** - Project photo documentation with gallery and entity linking

## Phase Details

### Phase 1: Bids
**Goal**: Users can collect vendor bids, compare them, and convert accepted bids to POs
**Depends on**: Nothing (first phase)
**Requirements**: BID-01, BID-02, BID-03, BID-04, BID-05
**Success Criteria** (what must be TRUE):
  1. User can create a bid request linked to a job
  2. User can upload bid documents from vendors
  3. User can mark bids as accepted/rejected
  4. User can compare multiple bids side-by-side
  5. User can convert an accepted bid to a Purchase Order
**Research**: Unlikely (follows existing PO/document patterns)
**Plans**: TBD

Plans:
- [ ] 01-01: Database schema and API routes
- [ ] 01-02: Frontend page and modals

### Phase 2: Estimates
**Goal**: Users can create cost estimates by cost code and convert them to job budgets
**Depends on**: Phase 1 (import from bids feature)
**Requirements**: EST-01, EST-02, EST-03, EST-04, EST-05
**Success Criteria** (what must be TRUE):
  1. User can create an estimate for a job
  2. User can add line items by cost code
  3. User can import amounts from accepted bids
  4. User can create new versions of an estimate
  5. User can convert approved estimate to job budget
**Research**: Unlikely (follows existing budget patterns)
**Plans**: TBD

Plans:
- [ ] 02-01: Database schema and API routes
- [ ] 02-02: Frontend page with line item editing

### Phase 3: Photos
**Goal**: Users can document project progress with photos linked to jobs and entities
**Depends on**: Nothing (can run parallel to Phase 2)
**Requirements**: PHO-01, PHO-02, PHO-03, PHO-04
**Success Criteria** (what must be TRUE):
  1. User can upload photos to a job
  2. User can add caption, location, and category to photos
  3. User can view photos in filterable gallery with lightbox
  4. User can link photos to inspections, punch items, or daily logs
**Research**: Unlikely (follows existing attachment patterns)
**Plans**: TBD

Plans:
- [ ] 03-01: Database schema and API routes
- [ ] 03-02: Frontend gallery and upload UI

## Progress

**Execution Order:**
Phase 1 → Phase 2 → Phase 3 (or Phase 2 + Phase 3 in parallel after Phase 1)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bids | 0/2 | Not started | - |
| 2. Estimates | 0/2 | Not started | - |
| 3. Photos | 0/2 | Not started | - |
