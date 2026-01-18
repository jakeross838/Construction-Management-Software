# Milestones

Historical record of shipped milestones.

## v1.3 Refinement

**Shipped:** 2026-01-18
**Phases:** 6 (18-23)
**Plans executed:** 6

### Highlights

- **Invoice AI - Extraction**: Two-stage pipeline (extract + validate) with OCR error correction and tiered confidence thresholds
- **Invoice AI - Matching**: Multi-signal PO matching with weighted scoring (vendor 40%, PO# 25%, amount 15%, date 10%, items 10%)
- **Invoice AI - Workflow**: Batch approval, quick actions on cards, confidence badges, one-click approve for high-confidence invoices
- **Reports - Backend**: Financial summary API with job cost, vendor spend, and category spend reports
- **Reports - Excel**: Professional Excel exports with blue headers, currency formatting, and conditional status coloring
- **Reports - PDF**: Professional PDF exports using pdfmake with headers, footers, and page numbers

### Stats

| Metric | Value |
|--------|-------|
| Phases | 6 |
| Plans | 6 |
| Requirements | 6 (INV-AI-01, INV-AI-02, INV-AI-03, RPT-01, RPT-02, RPT-03) |

### Archive

- `.planning/milestones/v1.3-ROADMAP.md`
- `.planning/milestones/v1.3-REQUIREMENTS.md`

---

## v1.2 Gap Fixes

**Shipped:** 2026-01-18
**Phases:** 6 (12-17)

### Highlights

- Error handling with AppError class
- Jobs management with full CRUD and profile metrics
- Vendors with soft delete, documents, and duplicate detection
- Budget visualizations with Chart.js
- Gantt drag-and-drop and critical path highlighting
- Document versioning with history UI and rollback

---

## v1.1 Field Features

**Shipped:** 2026-01-17
**Phases:** 6 (6-11)

### Highlights

- Bids management with comparison and PO conversion
- Estimates with line items and budget conversion
- Photo attachments with gallery and lightbox
- Dashboard alerts for inspections, budgets, approvals
- Mobile responsive with hamburger menu
- Global search with Cmd/Ctrl+K

---

## v1.0 Core Platform

**Shipped:** 2026-01-17
**Phases:** 5 (1-5)

### Highlights

- Invoice AI processing with PDF extraction
- Purchase order management
- Draw workflow with G702/G703
- Daily logs, inspections, punch lists
- Real-time updates via SSE

---
*Milestone history created: 2026-01-18*
