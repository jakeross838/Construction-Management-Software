# Roadmap: Ross Built CMS

## Overview

Construction management software for Ross Built Custom Homes. Evolved from invoice processing into a complete business operating system, now a **data-driven estimation and intelligence platform**.

## Milestones

- [Archive: .planning/milestones/] v1.0-v2.0 (shipped)
- [x] **v2.1 Selections & Navigation Polish** - Phases 65-69 (shipped 2026-01-20) [Archive](milestones/v2.1-ROADMAP.md)
- [x] **v3.0 Smart Catalog & Estimation Engine** - Phases 70-77 (shipped 2026-01-20) [Archive](milestones/v3.0-ROADMAP.md)

<details>
<summary>v2.1 Selections & Navigation Polish (Phases 65-69) - SHIPPED 2026-01-20</summary>

### Phase 65: Navigation Audit & Fix
**Goal**: All pages use sidebar job selection pattern with URL state persistence
**Status**: Complete (2026-01-20)

### Phase 66: Selections Schema
**Goal**: Database ready to store products with multiple photos, specs, and variants
**Status**: Complete (2026-01-20)

### Phase 67: Visual Catalog UI
**Goal**: Staff can browse products in visual grid with category navigation and filters
**Status**: Complete (2026-01-20)

### Phase 68: Catalog Management
**Goal**: Staff can add, edit, and organize products in the catalog
**Status**: Complete (2026-01-20)

### Phase 69: Selections Integration
**Goal**: Selections connect to jobs, allowances, and change orders
**Status**: Complete (2026-01-20)

</details>

<details>
<summary>v3.0 Smart Catalog & Estimation Engine (Phases 70-77) - SHIPPED 2026-01-20</summary>

**Milestone Goal:** Build data infrastructure that turns selections into estimates, schedules, and downstream documents.

- Phase 70: Smart Catalog Foundation - Enhanced catalog with labor/duration/lead time/dependency data
- Phase 70.1: AI Document Intelligence Hub - Document processing that routes data everywhere
- Phase 71: Construction Knowledge Base - Warnings, quality checks, pre-reqs attached to catalog items
- Phase 72: Selection-Driven Estimation - Pick selections, auto-calculate costs
- Phase 73: Schedule Intelligence - Generate timeline from selections + dependencies
- Phase 74: Trade Scorecards - Quality/speed/reliability metrics for trades and vendors
- Phase 75: Document Intelligence - AI parsing routes to all systems
- Phase 76: Feedback Loops - Actuals update catalog pricing and duration estimates
- Phase 77: UI Consistency - Remove old upload buttons, add sidebar to all job-specific pages

**Key Decisions:**
- decimal.js for precise money calculations
- toposort for dependency resolution in scheduling
- Frappe Gantt for schedule visualization
- Internal tool first, lead-facing portal deferred to v3.1+

See [v3.0 Archive](milestones/v3.0-ROADMAP.md) for full phase details.

</details>

## Next Milestone

*To be defined. Run `/gsd:discuss-milestone` to explore options.*

---
*Last updated: 2026-01-20*
