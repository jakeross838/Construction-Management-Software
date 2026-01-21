# Project Brief: Ross Built CMS

## Overview

Construction management software for Ross Built Custom Homes. Started as invoice processing, evolved into a complete business operating system, now a **data-driven estimation and intelligence platform** where every document enriches the system and every actual feeds back to improve future predictions.

**Current State:** v3.0 Smart Catalog & Estimation Engine (shipped 2026-01-20)
**Next Milestone:** To be defined

## Core Value

**Run your entire construction business from one intelligent system** - where every document uploaded, every selection made, and every invoice paid makes the system smarter. From leads through closeout, with AI-powered data extraction that flows to all connected systems.

## Current State (v3.0 Shipped)

**Shipped:** 2026-01-20

Smart Catalog & Estimation Engine with:
- Enhanced catalog with labor hours, install duration, lead times, waste factors, coverage rates
- Quality tiers (builder/standard/premium) and trade linking
- Dependency relationships for scheduling
- AI Document Intelligence Hub that routes extracted data to all systems
- Construction Knowledge Base (warnings, quality checks, pre-reqs, inspection points)
- Selection-driven estimation with auto-calculated costs
- Schedule generation with dependency sequencing and critical path
- Trade scorecards with quality/speed/reliability metrics
- Feedback loops from actuals to improve predictions

**Key Technologies Added:**
- decimal.js for precise money calculations
- toposort for dependency resolution in scheduling
- Frappe Gantt for schedule visualization

## Feature Inventory

Shipped through v3.0 with ~110,000+ lines of JavaScript across 120+ files.

**Complete:**
- Invoices - AI extraction, OCR, approval workflow, PDF stamping, splits, credits
- Purchase Orders - CRUD, line items, approval, change orders, attachments
- Draws - G702/G703, Excel/PDF export, workflow
- Bids - CRUD, documents, comparison, PO conversion
- Estimates - Selection-driven, auto-calculation, versioning, downstream conversion
- Price Intelligence - Master items, vendor prices, order optimizer, savings tracker
- Leads/CRM - Pipeline, qualification, activities, job conversion
- Selections/Allowances - Visual catalog, budgets, variance tracking, change orders
- Catalog - Smart catalog with labor/duration/dependencies, trade linking, knowledge base
- Schedule Intelligence - Generation from selections, dependency sequencing, Gantt view
- Trade Scorecards - Performance tracking, capacity, recommendations
- Document Intelligence - AI parsing with multi-system routing
- Feedback Loops - Actuals update catalog predictions
- Crew Scheduling - Work requests, auto-scheduling, calendar view
- Permitting - Applications, inspections, documents, status tracking
- Job Hub - 360° view with financials, activity, status
- All scaffold modules (RFIs, Submittals, Tasks, Messaging, Notifications, Warranties, Closeout)

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
| Math | decimal.js |
| Scheduling | toposort, Frappe Gantt |

**Key Patterns:**
- All tables use `v2_` prefix
- Soft deletes via `deleted_at`
- Modal class `.show` required for visibility
- API caching via `window.APICache`
- asyncHandler wrapper on all routes

## Constraints

1. **No frameworks** - Keep frontend vanilla JS
2. **Dark theme only** - Use CSS variables
3. **Existing patterns** - Follow conventions in CLAUDE.md
4. **Supabase** - All data through Supabase client
5. **Migration numbering** - Continue from current highest

## Key Decisions

| Date | Decision | Rationale | Outcome |
|------|----------|-----------|---------|
| 2026-01-20 | decimal.js for money | Precise financial calculations | Shipped v3.0 |
| 2026-01-20 | toposort for scheduling | Reliable dependency resolution | Shipped v3.0 |
| 2026-01-20 | Frappe Gantt | Clean schedule visualization | Shipped v3.0 |
| 2026-01-20 | Internal first, leads later | Validate estimation engine before exposing | Shipped v3.0 |
| 2026-01-20 | Document intelligence routes to all systems | Every upload enriches entire platform | Shipped v3.0 |
| 2026-01-20 | Feedback loops from actuals | System gets smarter with use | Shipped v3.0 |

## Deferred Features (v3.1+)

| Feature | Reason |
|---------|--------|
| Lead-facing portal | Build internal tool first, validate, then expose |
| AI floor plan extraction | Complex, manual entry works for now |
| Architect/designer portal | Future lead gen channel after core is solid |
| Calendar integrations | Not critical for current features |
| QuickBooks sync | Separate integration milestone |
| Budget/quality/timeline optimizer | After data collection proves valuable |

## References

- `CLAUDE.md` - Full system documentation
- `.planning/codebase/` - Codebase mapping
- `.planning/milestones/` - Shipped milestone archives
- `database/migration-*.sql` - Schema history

---
*Last updated: 2026-01-20 — v3.0 Smart Catalog & Estimation Engine shipped*
