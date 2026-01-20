# Milestones

Historical record of shipped milestones.

## v1.8 Invoice Variance & Data Linkage

**Shipped:** 2026-01-19
**Phases:** 5 (47-51)
**Plans executed:** 17

### Highlights

- **Variance Detection**: Polished line item matching with 35 unit tests, VPO/CO creation directly from variance warnings
- **Cost Code Linkage**: Fuzzy matching (Levenshtein) for 90%+ accuracy, G703 validation blocks bad allocations
- **Data Correlation**: Validation endpoints for linkages, CO/VPO totals, price intelligence, budget accuracy
- **AI PO Generation**: Document upload extracts line items, assigns cost codes via learned patterns, fuzzy job/vendor matching
- **Quick Fixes**: One-click fix endpoints, Fix Modal UI with bulk operations, standardized error messages with actionable hints

### Stats

| Metric | Value |
|--------|-------|
| Phases | 5 (47-51) |
| Plans | 17 |
| Requirements | 17 (VAR-*, CCL-*, COR-*, AIPO-*, FIX-*) |
| Files Modified | 20 |
| Lines Added | 7,087 |
| Timeline | 1 day |

### Archive

- `.planning/milestones/v1.8-ROADMAP.md`
- `.planning/milestones/v1.8-REQUIREMENTS.md`
- `.planning/milestones/v1.8-MILESTONE-AUDIT.md`

---

## v1.7 Data Integrity & AI Accuracy

**Shipped:** 2026-01-19
**Phases:** 4 (43-46)
**Plans executed:** 16

### Highlights

- **Budget RPC Functions**: Atomic `increment_committed_amount` and `decrement_committed_amount` for PO approval/void
- **Invoice Pipeline Safety**: Allocation cleanup on deny/delete, transaction wrapping with best-effort rollback
- **Draw Accuracy**: Total recalculation on GET, zero-billed cost codes in G703, allocation validation
- **PO/CO Linking**: Bidirectional invoiced_amount sync, CO mutual exclusivity validation
- **AI Improvements**: 70% confidence threshold (was 50%), robust date validation, better vendor extraction

### Stats

| Metric | Value |
|--------|-------|
| Phases | 4 (43-46) |
| Plans | 16 |
| Requirements | 19 (BUD-INT-*, INV-INT-*, DRW-INT-*, PO-INT-*, AI-INT-*) |
| Timeline | 1 day |

### Archive

- `.planning/milestones/v1.7-ROADMAP.md`
- `.planning/milestones/v1.7-REQUIREMENTS.md`

---

## v1.6 Module Expansion

**Shipped:** 2026-01-19
**Phases:** 6 (37-42)
**Plans executed:** 17

### Highlights

- **Leads/CRM**: Full pipeline management with 7 stages (Inquiry → Won/Lost), qualification scoring (hot/warm/cool/cold), activity tracking (calls, emails, meetings), tasks with due dates, job conversion
- **Selections/Allowances**: Categories, allowance budgets per job, catalog of options, client selections with pricing, automatic variance calculation, change order creation from overages
- **7 Scaffold Modules**: Full implementations (not just placeholders) for RFIs, Submittals, Tasks, Messaging, Notifications, Warranties, Closeout
- **Navigation Reorganization**: 9 logical groups following construction lifecycle (Dashboard, Sales, Pre-Con, Execution, Field, Finance, Closeout, Admin, Comms)

### Stats

| Metric | Value |
|--------|-------|
| Phases | 6 (37-42) |
| Plans | 17 |
| Requirements | 34 (LED-*, SEL-*, SCF-*, NAV-*) |
| New Tables | 10 (leads, selections, scaffold modules) |
| Core Files | ~5,400 lines |
| Timeline | 2 days |

### Archive

- `.planning/milestones/v1.6-ROADMAP.md`
- `.planning/milestones/v1.6-REQUIREMENTS.md`

---

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
