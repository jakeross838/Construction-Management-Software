# Project Brief: Ross Built CMS

## Overview

Construction management software for Ross Built Custom Homes. Manages the full lifecycle from bidding through payment: Bids → Estimates → Budgets → POs → Invoices → Draws → Payment.

**Last Milestone:** v1.1 - Field Features (shipped 2026-01-17)

## Core Value

**Streamline construction financial workflows** - from receiving vendor bids through final payment, with AI-powered invoice processing and AIA G702/G703 pay application generation.

## Current State

Shipped v1.1 with 96,297 lines of JavaScript across 76 files.

**Fully Complete:**
- Invoices - AI extraction, OCR, approval workflow, PDF stamping, splits, credits
- Purchase Orders - CRUD, line items, approval, change orders, attachments
- Draws - G702/G703, Excel/PDF export, workflow
- Daily Logs - Crew, weather, work summary, photos
- Inspections - Types, status, deficiencies, photos, re-inspections
- Punch Lists - Items, workflow, photos, retainage, PO blocking
- Cost Codes - Master list, categories, picker component
- Real-time - SSE, offline queue, connection status
- **Bids** - CRUD, documents, comparison, PO conversion (v1.1)
- **Estimates** - Line items, versioning, bid import, budget conversion (v1.1)
- **Photos** - Upload, gallery, lightbox, entity linking (v1.1)
- **Dashboard Alerts** - Inspections, budget overruns, approvals, punch items (v1.1)
- **Mobile Responsive** - Hamburger menu, scrollable tables, full-screen modals (v1.1)
- **Global Search** - Cmd/Ctrl+K across jobs, vendors, invoices, POs (v1.1)

**Gap Fixes Needed (Phases 1-6):**
- Foundation - Error handling inconsistent, no request validation
- Jobs - Missing CRUD routes, status workflow
- Vendors - Missing delete, documents, duplicate merge
- Budgets - Basic UI, no forecasting
- Schedules - Gantt needs enhancement
- Documents - Version tracking incomplete

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Frontend | Vanilla JavaScript |
| AI | Claude API (Anthropic) |
| PDF | pdf-lib, pdf-parse |

**Key Patterns:**
- All tables use `v2_` prefix
- Soft deletes via `deleted_at`
- Modal class `.show` required for visibility
- API caching via `window.APICache`

## Constraints

1. **No frameworks** - Keep frontend vanilla JS
2. **Dark theme only** - Use CSS variables, no hardcoded colors
3. **Existing patterns** - Follow conventions in CLAUDE.md
4. **Supabase** - All data through Supabase client
5. **Migration numbering** - Continue from migration-047

## Requirements

### Validated (Shipped)

- ✓ BID-01 to BID-05 — v1.1 (bid collection, comparison, PO conversion)
- ✓ EST-01 to EST-05 — v1.1 (estimates, versioning, budget conversion)
- ✓ PHO-01 to PHO-04 — v1.1 (photos, gallery, entity linking)
- ✓ DASH-01 to DASH-02 — v1.1 (dashboard alerts, activity)
- ✓ UX-02 to UX-03 — v1.1 (global search, mobile responsive)
- ✓ INV-01 to INV-12 — v1.0 (invoices, AI, OCR, workflow)
- ✓ PO-01 to PO-07 — v1.0 (purchase orders, change orders)
- ✓ DRW-01 to DRW-07 — v1.0 (draws, G702/G703)
- ✓ LOG-01 to LOG-04 — v1.0 (daily logs)
- ✓ INS-01 to INS-04 — v1.0 (inspections)
- ✓ PUN-01 to PUN-06 — v1.0 (punch lists)

### Active (Next Milestone)

- [ ] FND-01, FND-04: Error handling, request validation
- [ ] JOB-01, JOB-02, JOB-04: Job CRUD, status workflow, profile
- [ ] VND-01, VND-02, VND-03: Vendor delete, documents, duplicate merge
- [ ] BUD-04: Budget UI, forecasting
- [ ] SCH-03: Gantt enhancements
- [ ] DOC-03: Document versioning

### Out of Scope

- Mobile native app — web works on mobile now
- Video/audio attachments — photos sufficient for documentation
- Multi-company tenancy — single company use case

## Key Decisions

| Date | Decision | Rationale | Outcome |
|------|----------|-----------|---------|
| 2026-01-17 | v1.1 ships new features first | Complete placeholder features before gap fixes | ✓ Good |
| 2026-01-17 | Follow existing page patterns | Consistency with inspections.js, punch-lists.js | ✓ Good |
| 2026-01-17 | Photos in invoices bucket | Reuse existing bucket, path-based organization | ✓ Good |
| 2026-01-17 | Dashboard client-side filtering | Supabase doesn't support column comparison | — Pending |

## References

- `CLAUDE.md` - Full system documentation
- `.planning/codebase/` - Codebase mapping
- `.planning/MILESTONES.md` - Shipped milestones
- `database/migration-*.sql` - Schema history

---
*Last updated: 2026-01-17 after v1.1 milestone*
