# Roadmap: Ross Built CMS v1.3

## Overview

v1.3 Refinement improves invoice processing accuracy and adds comprehensive reporting capabilities. Six phases split evenly between Invoice AI improvements (extraction, matching, workflow) and Reporting suite (backend, Excel, PDF).

## Milestones

- **v1.2 Gap Fixes** - Phases 12-17 (shipped 2026-01-18)
- **v1.3 Refinement** - Phases 18-23 (in progress)

## Phases

- [x] **Phase 18: Invoice AI - Extraction** - Two-stage pipeline for better accuracy
- [x] **Phase 19: Invoice AI - Matching** - Multi-signal PO/job matching
- [x] **Phase 20: Invoice AI - Workflow** - Streamlined approval with fewer clicks
- [x] **Phase 21: Reports - Backend** - Reports API with financial summaries
- [ ] **Phase 22: Reports - Excel** - Excel export for any data view
- [ ] **Phase 23: Reports - PDF** - Professional PDF reports

## Phase Details

### Phase 18: Invoice AI - Extraction
**Goal**: Improve invoice data extraction accuracy via two-stage pipeline
**Depends on**: Nothing (first v1.3 phase)
**Requirements**: INV-AI-01
**Success Criteria** (what must be TRUE):
  1. Invoice amounts, dates, and vendor names extract with higher accuracy
  2. Two-stage process: extract → validate with cross-field checks
  3. Confidence scores reflect actual extraction quality
**Research**: Unlikely (existing Claude API patterns)
**Plans**: 18-01-PLAN.md (Two-Stage Extraction Pipeline)

### Phase 19: Invoice AI - Matching
**Goal**: Smarter PO/job matching with multi-signal confidence scoring
**Depends on**: Phase 18
**Requirements**: INV-AI-02
**Success Criteria** (what must be TRUE):
  1. Invoices auto-match to POs using multiple signals (vendor, amount, date, items)
  2. Match confidence reflects signal strength combination
  3. Ambiguous matches flagged for review instead of wrong auto-assignment
**Research**: Unlikely (existing matching patterns)
**Plans**: 19-01-PLAN.md (Multi-Signal PO Matching)

### Phase 20: Invoice AI - Workflow
**Goal**: Streamlined approval workflow with fewer clicks
**Depends on**: Phase 18, Phase 19
**Requirements**: INV-AI-03
**Success Criteria** (what must be TRUE):
  1. High-confidence invoices can be approved with fewer clicks
  2. Batch approval available for multiple invoices
  3. Quick actions for common corrections (swap job, change amount)
**Research**: Unlikely (existing UI patterns)
**Plans**: 20-01-PLAN.md (Streamlined Approval Workflow)

### Phase 21: Reports - Backend
**Goal**: Reports API with financial summaries
**Depends on**: Nothing (parallel track)
**Requirements**: RPT-01
**Success Criteria** (what must be TRUE):
  1. Job cost report available (budget vs actual by cost code)
  2. Vendor spend report available (spend by vendor with totals)
  3. Category spend report available (spend by cost code category)
  4. Reports support date range filtering
**Research**: Unlikely (existing Express patterns)
**Plans**: 21-01-PLAN.md (Reports API Endpoints)

### Phase 22: Reports - Excel
**Goal**: Excel export for any data view
**Depends on**: Phase 21
**Requirements**: RPT-02
**Success Criteria** (what must be TRUE):
  1. User can export job cost report to Excel
  2. User can export vendor spend report to Excel
  3. Excel files have professional formatting (headers, currency format)
**Research**: Unlikely (ExcelJS already in use)
**Plans**: 22-01-PLAN.md (Excel Export Endpoints)

### Phase 23: Reports - PDF
**Goal**: Professional PDF reports for clients and owners
**Depends on**: Phase 21
**Requirements**: RPT-03
**Success Criteria** (what must be TRUE):
  1. User can generate PDF job cost report
  2. User can generate PDF vendor spend report
  3. PDFs have professional layout with headers, footers, page numbers
  4. PDFs are suitable for sharing with clients/owners
**Research**: Likely (pdfmake is new)
**Research topics**: pdfmake integration, declarative layout patterns, table formatting
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 18. Invoice AI - Extraction | 1/1 | Complete | 2026-01-18 |
| 19. Invoice AI - Matching | 1/1 | Complete | 2026-01-18 |
| 20. Invoice AI - Workflow | 1/1 | Complete | 2026-01-18 |
| 21. Reports - Backend | 1/1 | Complete | 2026-01-18 |
| 22. Reports - Excel | 0/1 | Planned | - |
| 23. Reports - PDF | 0/? | Not started | - |

---
*Roadmap created: 2026-01-18*
