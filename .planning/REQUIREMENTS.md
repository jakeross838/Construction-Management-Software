# Requirements: Ross Built CMS v1.2

**Defined:** 2026-01-17
**Core Value:** Streamline construction financial workflows from bidding through payment

## v1.2 Requirements

Gap fixes to complete existing features and improve system reliability.

### Foundation

- [x] **FND-01**: Consistent error handling - All API routes return standardized error responses with proper HTTP codes
- [x] **FND-04**: Request validation - Critical endpoints validate request body/params before processing

### Jobs

- [x] **JOB-01**: Job CRUD - User can create, update, and soft-delete jobs via API
- [x] **JOB-02**: Job status workflow - Jobs transition through active/completed/on_hold with audit trail
- [x] **JOB-04**: Job profile metrics - Job profile page shows budget summary, PO count, invoice totals, completion %

### Vendors

- [x] **VND-01**: Vendor management - User can delete vendors (soft delete), search by name, merge duplicates
- [x] **VND-02**: Vendor documents - User can upload W-9, insurance certificates, licenses with expiration tracking
- [x] **VND-03**: Duplicate detection - System warns on vendor create if similar vendor exists

### Budgets

- [ ] **BUD-04**: Budget visualization - User sees budget vs actuals comparison, variance alerts, basic trend forecasting

### Schedules

- [ ] **SCH-03**: Gantt enhancements - Interactive Gantt with drag-and-drop task editing, critical path highlighting

### Documents

- [ ] **DOC-03**: Document versioning - User can view version history, compare versions, rollback to previous version

## v2 Requirements

Deferred to future releases.

### Advanced Features

- **ADV-01**: Mobile native app (if web insufficient)
- **ADV-02**: Multi-company tenancy
- **ADV-03**: Advanced Gantt (milestones, resource leveling)
- **ADV-04**: AI-powered budget forecasting (beyond basic trends)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mobile native app | Web works on mobile (v1.1 mobile responsive) |
| Video/audio attachments | Photos sufficient for documentation |
| Multi-company tenancy | Single company use case |
| Real-time collaborative editing | SSE covers live updates |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 12 | Complete |
| FND-04 | Phase 12 | Complete |
| JOB-01 | Phase 13 | Complete |
| JOB-02 | Phase 13 | Complete |
| JOB-04 | Phase 13 | Complete |
| VND-01 | Phase 14 | Complete |
| VND-02 | Phase 14 | Complete |
| VND-03 | Phase 14 | Complete |
| BUD-04 | Phase 15 | Pending |
| SCH-03 | Phase 16 | Pending |
| DOC-03 | Phase 17 | Pending |

**Coverage:**
- v1.2 requirements: 11 total
- Mapped to phases: 11 ✓
- Unmapped: 0

---
*Requirements defined: 2026-01-17*
*Last updated: 2026-01-17 after v1.1 milestone completion*
