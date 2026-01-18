# Roadmap: Ross Built CMS

## Milestones

- ✅ **v1.1 Field Features** — Phases 7-11 (shipped 2026-01-17)
- 🚧 **v1.2 Gap Fixes** — Phases 12-17 (in progress)

---

## Phases

<details>
<summary>✅ v1.1 Field Features (Phases 7-11) — SHIPPED 2026-01-17</summary>

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

- [x] Phase 7: Bids (2/2 plans)
- [x] Phase 8: Estimates (1/1 plan)
- [x] Phase 9: Photos (2/2 plans)
- [x] Phase 10: Dashboard (1/1 plan)
- [x] Phase 11: UX Polish (2/2 plans)

</details>

### 🚧 v1.2 Gap Fixes (In Progress)

**Milestone Goal:** Complete existing features and improve system reliability.

---

### Phase 12: Foundation Polish ✓
**Goal**: Standardize error handling and add request validation
**Depends on**: Nothing (can start immediately)
**Requirements**: FND-01, FND-04
**Success Criteria** (what must be TRUE):
  1. All API errors return consistent JSON structure with error code ✓
  2. Invalid requests to critical endpoints return 400 with validation details ✓
  3. No unhandled exceptions leak to client ✓
**Research**: Unlikely (internal patterns, existing error.js)
**Plans**: 1/1 complete

Plans:
- [x] 12-01: Error handling and validation

---

### Phase 13: Jobs Completion ✓
**Goal**: Complete Job CRUD and profile functionality
**Depends on**: Phase 12 (uses error handling)
**Requirements**: JOB-01, JOB-02, JOB-04
**Success Criteria** (what must be TRUE):
  1. User can create a new job via POST /api/jobs ✓
  2. User can update job details via PATCH /api/jobs/:id ✓
  3. User can archive/delete job via DELETE /api/jobs/:id ✓
  4. Job status changes are logged in audit trail ✓
  5. Job profile shows real-time budget, PO, and invoice metrics ✓
**Research**: Unlikely (follows existing route patterns)
**Plans**: 2/2 complete

Plans:
- [x] 13-01: Job CRUD API routes (create, update, delete, status workflow, activity logging)
- [x] 13-02: Job profile page enhancements (financial metrics display)

---

### Phase 14: Vendors Completion
**Goal**: Complete vendor management including documents and duplicate handling
**Depends on**: Phase 12 (uses validation)
**Requirements**: VND-01, VND-02, VND-03
**Success Criteria** (what must be TRUE):
  1. User can soft-delete vendors
  2. User can search vendors by name
  3. User can merge duplicate vendors
  4. User can upload vendor documents (W-9, insurance, licenses)
  5. System warns when creating vendor similar to existing
**Research**: Unlikely (follows existing patterns)
**Plans**: TBD

Plans:
- [ ] 14-01: Vendor CRUD completion
- [ ] 14-02: Vendor documents system
- [ ] 14-03: Duplicate detection enhancement

---

### Phase 15: Budget Enhancements
**Goal**: Improve budget visualization and add forecasting
**Depends on**: Nothing (independent)
**Requirements**: BUD-04
**Success Criteria** (what must be TRUE):
  1. User sees budget vs actuals side-by-side comparison
  2. User sees variance alerts for budget overruns
  3. User sees basic spend trend forecasting
**Research**: Unlikely (UI enhancement, existing data)
**Plans**: TBD

Plans:
- [ ] 15-01: Budget page UI enhancements

---

### Phase 16: Schedule Improvements
**Goal**: Enhance Gantt visualization and task management
**Depends on**: Nothing (independent)
**Requirements**: SCH-03
**Success Criteria** (what must be TRUE):
  1. User can drag tasks on Gantt to change dates
  2. User can see critical path highlighted
  3. Gantt updates persist to database
**Research**: Likely (Gantt library options)
**Research topics**: Vanilla JS Gantt libraries, drag-drop interaction patterns
**Plans**: TBD

Plans:
- [ ] 16-01: Gantt chart enhancements

---

### Phase 17: Document Versioning
**Goal**: Add proper version tracking and comparison
**Depends on**: Nothing (independent)
**Requirements**: DOC-03
**Success Criteria** (what must be TRUE):
  1. User can view version history of document
  2. User can compare two versions (show diffs)
  3. User can rollback to previous version
**Research**: Unlikely (storage patterns exist)
**Plans**: TBD

Plans:
- [ ] 17-01: Document version system

---

## Progress

**Execution Order:**
Phases 12-17 can mostly run in parallel (12 first for foundation, then 13-17)

| Phase | Name | Plans | Status | Priority |
|-------|------|-------|--------|----------|
| 12 | Foundation Polish | 1/1 | Complete | P0 |
| 13 | Jobs Completion | 2/2 | Complete | P1 |
| 14 | Vendors Completion | 0/3 | Not started | P1 |
| 15 | Budget Enhancements | 0/1 | Not started | P2 |
| 16 | Schedule Improvements | 0/1 | Not started | P2 |
| 17 | Document Versioning | 0/1 | Not started | P2 |

**Priority Legend:**
- P0: Foundation (do first)
- P1: Important gaps
- P2: Polish and enhancements
