# Project Brief: Ross Built CMS

## Overview

Construction management software for Ross Built Custom Homes. Manages the full lifecycle from bidding through payment: Bids → Estimates → Budgets → POs → Invoices → Draws → Payment.

**Last Milestone:** v1.6 - Module Expansion (shipped 2026-01-19)
**Current Milestone:** Planning next milestone

## Core Value

**Streamline construction financial workflows** - from receiving vendor bids through final payment, with AI-powered invoice processing and AIA G702/G703 pay application generation.

## Current State

Shipped v1.6 with ~110,000+ lines of JavaScript across 95+ files. CSS standardized at 25,947 lines.

**Fully Complete:**
- Invoices - AI extraction, OCR, approval workflow, PDF stamping, splits, credits
- Invoice AI - Two-stage extraction, multi-signal PO matching, batch approval (v1.3)
- Purchase Orders - CRUD, line items, approval, change orders, attachments, price warnings (v1.4)
- Draws - G702/G703, Excel/PDF export, workflow
- Reports - Financial summaries, Excel exports, PDF exports (v1.3)
- Daily Logs - Crew, weather, work summary, photos
- Inspections - Types, status, deficiencies, photos, re-inspections
- Punch Lists - Items, workflow, photos, retainage, PO blocking
- Cost Codes - Master list, categories, picker component
- Real-time - SSE, offline queue, connection status
- Bids - CRUD, documents, comparison, PO conversion (v1.1)
- Estimates - Line items, versioning, bid import, budget conversion (v1.1)
- Photos - Upload, gallery, lightbox, entity linking (v1.1)
- Dashboard Alerts - Inspections, budget overruns, approvals, punch items (v1.1)
- Mobile Responsive - Hamburger menu, scrollable tables, full-screen modals (v1.1)
- Global Search - Cmd/Ctrl+K across jobs, vendors, invoices, POs (v1.1)
- Error Handling - Consistent API responses, request validation (v1.2)
- Jobs - Full CRUD, soft delete, audit logging, profile metrics (v1.2)
- Vendors - Soft delete, documents, duplicate detection, merge (v1.2)
- Budgets - Chart visualizations, variance alerts, spend forecasting (v1.2)
- Schedules - Drag-and-drop Gantt, critical path highlighting (v1.2)
- Documents - Version tracking, history UI, rollback, comparison (v1.2)
- Price Intelligence - Master items, vendor prices, order optimizer, savings tracker (v1.4)
- Spend Analytics - Vendor spend breakdown, negotiation insights (v1.4)
- Leads/CRM - 7-stage pipeline, qualification scoring, activities, job conversion (v1.6)
- Selections/Allowances - Categories, budgets, variance tracking, change orders (v1.6)
- RFIs, Submittals, Tasks, Messaging, Notifications, Warranties, Closeout - Full modules (v1.6)
- Grouped Navigation - 9 groups following construction lifecycle (v1.6)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Frontend | Vanilla JavaScript |
| AI | Claude API (Anthropic) |
| PDF | pdf-lib, pdf-parse |
| Charts | Chart.js |

**Key Patterns:**
- All tables use `v2_` prefix
- Soft deletes via `deleted_at`
- Modal class `.show` required for visibility
- API caching via `window.APICache`
- asyncHandler wrapper on all routes
- Version tracking via `is_current` flag pattern

## Constraints

1. **No frameworks** - Keep frontend vanilla JS
2. **Dark theme only** - Use CSS variables, no hardcoded colors
3. **Existing patterns** - Follow conventions in CLAUDE.md
4. **Supabase** - All data through Supabase client
5. **Migration numbering** - Continue from migration-050

## Requirements

### Validated (Shipped)

- ✓ FND-01, FND-04 — v1.2 (error handling, validation)
- ✓ JOB-01, JOB-02, JOB-04 — v1.2 (job CRUD, status workflow, metrics)
- ✓ VND-01, VND-02, VND-03 — v1.2 (vendor management, documents, duplicates)
- ✓ BUD-04 — v1.2 (budget visualization)
- ✓ SCH-03 — v1.2 (Gantt enhancements)
- ✓ DOC-03 — v1.2 (document versioning)
- ✓ BID-01 to BID-05 — v1.1 (bids)
- ✓ EST-01 to EST-05 — v1.1 (estimates)
- ✓ PHO-01 to PHO-04 — v1.1 (photos)
- ✓ DASH-01 to DASH-02 — v1.1 (dashboard)
- ✓ UX-02 to UX-03 — v1.1 (search, mobile)
- ✓ INV-01 to INV-12 — v1.0 (invoices)
- ✓ PO-01 to PO-07 — v1.0 (purchase orders)
- ✓ DRW-01 to DRW-07 — v1.0 (draws)
- ✓ LOG-01 to LOG-04 — v1.0 (daily logs)
- ✓ INS-01 to INS-04 — v1.0 (inspections)
- ✓ PUN-01 to PUN-06 — v1.0 (punch lists)

### v1.3 Refinement (Shipped)

**Invoice AI Improvements:**
- [x] INV-AI-01: Improve extraction accuracy for amounts, dates, and vendor names
- [x] INV-AI-02: Smarter auto-matching to POs and jobs with better confidence scoring
- [x] INV-AI-03: Streamline approval workflow to reduce clicks and confusion

**Reporting Suite:**
- [x] RPT-01: Financial summaries (job cost reports, spend by vendor, spend by category)
- [x] RPT-02: Custom Excel exports (export any data view to Excel)
- [x] RPT-03: PDF reports (printable professional reports for clients/owners)

### v1.4 Price Intelligence (Shipped)

**Price Intelligence:**
- [x] PRC-01: User can browse/search master items with vendor price comparison
- [x] PRC-02: User can paste material list and get optimal vendor split recommendations
- [x] PRC-03: User can track savings from optimized orders over time
- [x] PRC-04: User can analyze vendor spend for negotiation leverage
- [x] PRC-05: User sees price warning when creating PO with better options available

### v1.5 UI Cleanup & Uniformity (Shipped)

**UI Standards & Components:**
- [x] UI-01: All buttons use consistent sizes, colors, and states
- [x] UI-02: All form inputs follow same styling patterns
- [x] UI-03: All badges/status indicators are uniform
- [x] UI-04: All modals have consistent structure (header, body, footer)
- [x] UI-05: All tables use same styling and interactions
- [x] UI-06: All forms show validation errors consistently
- [x] UI-07: Navigation and layout is uniform across pages
- [x] UI-08: All pages use CSS variables (no hardcoded colors)
- [x] UI-09: Loading and empty states are consistent
- [x] UI-10: Mobile experience is uniform across all pages

### v1.6 Module Expansion (Shipped)

**Fully Built Modules:**
- [x] LED-01: Leads/CRM - Pipeline stages, lead capture, qualification, follow-ups
- [x] LED-02: Leads/CRM - Conversion to Job when won, contact history, notes
- [x] SEL-01: Selections - Categories (flooring, fixtures, appliances), allowance budgets
- [x] SEL-02: Selections - Client choices with pricing, over/under tracking
- [x] SEL-03: Selections - Change order integration for overages, PDF export

**Scaffolded Modules (full implementations):**
- [x] SCF-01: RFIs - Request for Information with full CRUD
- [x] SCF-02: Submittals - Shop drawings, samples, product data
- [x] SCF-03: Tasks - Assignable work items
- [x] SCF-04: Messaging - In-app messaging
- [x] SCF-05: Notifications - Centralized notifications
- [x] SCF-06: Warranties - Product/workmanship warranty tracking
- [x] SCF-07: Closeout - Final documents, certificates, handover

**Navigation & Organization:**
- [x] NAV-01: Reorganize sidebar into logical groups (Sales, Pre-Con, Execution, Field, Finance, Comms)

### Out of Scope

- Mobile native app — web works on mobile now
- Video/audio attachments — photos sufficient for documentation
- Multi-company tenancy — single company use case
- Real-time collaborative editing — SSE covers live updates

## Key Decisions

| Date | Decision | Rationale | Outcome |
|------|----------|-----------|---------|
| 2026-01-17 | v1.1 ships new features first | Complete placeholder features before gap fixes | ✓ Good |
| 2026-01-17 | Follow existing page patterns | Consistency with inspections.js, punch-lists.js | ✓ Good |
| 2026-01-17 | Photos in invoices bucket | Reuse existing bucket, path-based organization | ✓ Good |
| 2026-01-17 | Dashboard client-side filtering | Supabase doesn't support column comparison | ✓ Good |
| 2026-01-17 | asyncHandler wrapper for routes | Consistent error handling without try/catch | ✓ Good |
| 2026-01-17 | Vendor documents is_current flag | Version tracking without separate table | ✓ Good |
| 2026-01-17 | 75% threshold for duplicate detection | Balances false positives vs missed duplicates | ✓ Good |
| 2026-01-18 | Chart.js for budget visualizations | Already bundled, simple API | ✓ Good |
| 2026-01-18 | Critical path: forward/backward pass | Standard CPM algorithm, efficient | ✓ Good |
| 2026-01-18 | Document versioning follows vendor pattern | Consistency, proven approach | ✓ Good |
| 2026-01-18 | Master items schema with vendor aliases | Organic growth from invoices/quotes | ✓ Good |
| 2026-01-18 | Materialized view for current prices | Fast lookups without complex queries | ✓ Good |
| 2026-01-18 | 10% threshold for price warnings | Balances noise vs value | ✓ Good |

## References

- `CLAUDE.md` - Full system documentation
- `.planning/codebase/` - Codebase mapping
- `.planning/MILESTONES.md` - Shipped milestones
- `database/migration-*.sql` - Schema history

---
*Last updated: 2026-01-19 — v1.6 Module Expansion shipped*
