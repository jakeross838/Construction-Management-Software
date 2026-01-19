# Milestones

Historical record of shipped milestones.

## v1.5 UI Cleanup & Uniformity

**Shipped:** 2026-01-18
**Phases:** 7 (30-36)
**Plans executed:** 19

### Highlights

- **UI Standards Document**: Created comprehensive UI-STANDARDS.md (755 lines) documenting all CSS variables, components, patterns
- **Status Class Normalization**: Created `normalizeStatusClass()` helper, updated 8 JS modules, backward-compatible CSS aliases
- **Modal Consistency**: Unified modal header/footer patterns with `modal-title-row` across 14 HTML modals + 13 JS builders
- **Table Standardization**: Created `.data-table` base with 4 aliases, standardized empty states (15+ locations)
- **Form Unification**: Unified label styling, validation states, consolidated form layouts (-113 lines CSS)
- **CSS Variable Compliance**: Replaced all hardcoded colors with CSS variables, converted px to rem units

### Stats

| Metric | Value |
|--------|-------|
| Phases | 7 (30-36) |
| Plans | 19 |
| Requirements | 10 (UI-01 through UI-10) |
| Commits | ~62 |
| Files Modified | 88 |
| Net Changes | +12,621 / -1,772 lines |
| CSS Lines | 25,947 (standardized) |

### Archive

- `.planning/milestones/v1.5-ROADMAP.md`
- `.planning/milestones/v1.5-MILESTONE-AUDIT.md`

---

## v1.4 Price Intelligence

**Shipped:** 2026-01-18
**Phases:** 6 (24-29)
**Plans executed:** 6

### Highlights

- **Price Database**: Master item catalog with vendor price comparison and confidence scoring
- **Order Optimizer**: Material list parsing with waste factors and vendor split recommendations
- **Savings Tracker**: Historical savings analysis by job, category, and time period
- **Spend Analytics**: Vendor spend breakdown with negotiation insights
- **Frontend**: Price Intelligence page with 4 tabs (Price Database, Order Optimizer, Savings Tracker, Spend Analytics)
- **PO Integration**: Better-pricing warnings when creating POs with higher-than-necessary prices

### Stats

| Metric | Value |
|--------|-------|
| Phases | 6 |
| Plans | 6 |
| Requirements | 5 (PRC-01, PRC-02, PRC-03, PRC-04, PRC-05) |
| New Tables | 8 + 2 materialized views |
| New Endpoints | 30+ |
| Lines of Code | ~5,100 |

### Archive

- `.planning/milestones/v1.4-ROADMAP.md`
- `.planning/milestones/v1.4-REQUIREMENTS.md`

---

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
