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

## Current Milestone: v3.1 Business Intelligence & Financial Management

**Milestone Goal:** Transform Ross Built CMS into a full business management system with true job costing, overhead allocation using % of Labor Hours, and financial intelligence.

### Phase 78: Financial Foundation & Periods
**Goal**: Database schema and period management for financial tracking
**Depends on**: Nothing (first phase of v3.1)
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-06
**Success Criteria** (what must be TRUE):
  1. Admin can create expense entries with amount, vendor, category, date
  2. Expenses are categorized by overhead type (office, fleet, equipment, admin)
  3. Admin can open/close financial periods with period locking
  4. Expense list displays with filters (period, category, vendor)
**Research**: Unlikely (established patterns in codebase)
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 79: Expense Tracking Enhancements
**Goal**: Recurring expenses and receipt attachments
**Depends on**: Phase 78
**Requirements**: EXP-04, EXP-05
**Success Criteria** (what must be TRUE):
  1. Admin can configure recurring expenses (auto-create monthly)
  2. Admin can attach receipt documents to expenses
**Research**: Unlikely (internal patterns)
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 80: Employee & Labor Setup
**Goal**: Employee management and burden rate configuration
**Depends on**: Phase 78
**Requirements**: LAB-02, LAB-03, LAB-04, LAB-05, LAB-06
**Success Criteria** (what must be TRUE):
  1. Admin can manage employees (name, role, burden class)
  2. Admin can configure company-wide burden rate
  3. Admin can configure multiple burden rates by employee class
  4. System calculates burdened labor cost automatically
  5. System prompts quarterly burden rate review
**Research**: Likely (labor burden calculation patterns)
**Research topics**: Industry-standard burden rate components, calculation methods
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 81: Digital Timesheets
**Goal**: Replace paper timesheets with digital entry and approval
**Depends on**: Phase 80
**Requirements**: LAB-01, LAB-07, LAB-08, LAB-09, LAB-10, LAB-11, LAB-12
**Success Criteria** (what must be TRUE):
  1. Employee can submit digital timesheet (job, hours, date, notes)
  2. Employee can view their submitted time history
  3. Admin can view and approve submitted timesheets
  4. System validates timesheet entries (reasonable hours, valid jobs)
  5. Employee can edit timesheet within submission window
  6. User can view labor hours by job, employee, or period
**Research**: Unlikely (CRUD patterns)
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 82: Overhead Allocation Engine
**Goal**: Calculate and allocate overhead to jobs using % of Labor Hours
**Depends on**: Phase 81
**Requirements**: OVH-01, OVH-02, OVH-03, OVH-04, OVH-05, OVH-06
**Success Criteria** (what must be TRUE):
  1. Admin can configure cost pools (expense categories → overhead)
  2. Admin can set allocation method (% of Labor Hours)
  3. System calculates overhead rate (Total Overhead / Total Labor Hours)
  4. System allocates overhead to jobs based on labor hours
  5. Admin can view overhead rate dashboard (current rate, trend)
  6. System only allocates from closed periods
**Research**: Likely (allocation formula implementation)
**Research topics**: Rolling 12-month average calculations, period-based allocation patterns
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 83: Job Profitability Reports
**Goal**: Show true all-in job costs with allocated overhead
**Depends on**: Phase 82
**Requirements**: JOB-01, JOB-02, JOB-03, JOB-04, JOB-05, JOB-06
**Success Criteria** (what must be TRUE):
  1. User can view job cost summary (direct costs + burden + overhead)
  2. User can view budget vs actual by cost code
  3. User can compare jobs by profitability (ranked list)
  4. System stores monthly profitability snapshots
  5. User can view gross and net margin per job
  6. User can drill down from summary to cost details
**Research**: Unlikely (reporting patterns established)
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 84: WIP Schedule
**Goal**: Work-in-Progress schedule with over/under billing detection
**Depends on**: Phase 83
**Requirements**: WIP-01, WIP-02, WIP-03, WIP-04, WIP-05, WIP-06
**Success Criteria** (what must be TRUE):
  1. System calculates % complete (costs to date / estimated total)
  2. System calculates earned revenue (contract × % complete)
  3. System calculates over/under billing
  4. WIP auto-populates from existing draw data
  5. User can view WIP schedule report
  6. System alerts on significant over/under billing
**Research**: Likely (WIP accounting patterns)
**Research topics**: % completion accounting methods, billing variance thresholds
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 85: Company P&L Dashboard
**Goal**: Company-wide profit & loss visibility
**Depends on**: Phase 84
**Requirements**: PNL-01, PNL-02, PNL-03, PNL-04, PNL-05, PNL-06
**Success Criteria** (what must be TRUE):
  1. User can view revenue by period (contract revenue, change orders)
  2. User can view COGS breakdown (materials, labor, subs, equipment)
  3. User can view operating expenses by category (overhead)
  4. User can view gross profit and gross margin %
  5. User can view net income and net margin %
  6. User can compare periods (month vs month, YoY)
**Research**: Unlikely (Chart.js patterns established)
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 86: Cash Flow & Forecasting
**Goal**: AR/AP aging and 13-week cash flow projection
**Depends on**: Phase 85
**Requirements**: CSH-01, CSH-02, CSH-03, CSH-04, CSH-05
**Success Criteria** (what must be TRUE):
  1. User can view AR aging report (0-30, 31-60, 61-90, 90+ days)
  2. User can view AP aging report (by due date)
  3. System generates 13-week cash flow forecast
  4. System projects cash inflows from draw schedules
  5. System projects cash outflows from payables
**Research**: Likely (cash flow forecasting patterns)
**Research topics**: Rolling forecast models, receivables/payables aging calculations
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 87: Business Planning
**Goal**: Backlog, KPI dashboard, capacity planning, and pipeline
**Depends on**: Phase 86
**Requirements**: BIZ-01, BIZ-02, BIZ-03, BIZ-04, BIZ-05
**Success Criteria** (what must be TRUE):
  1. User can view backlog (signed work not completed, backlog months)
  2. User can view KPI dashboard (margins, backlog, DSO, variance)
  3. User can view capacity planning (labor hours available vs needed)
  4. User can view pipeline (leads → bids → signed → in progress)
  5. Admin can configure KPI targets and thresholds
**Research**: Unlikely (dashboard patterns established)
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 105: Estimates & Budget Consolidation
**Goal**: Merge estimates.html and budget-builder.html into unified Estimates & Budgets page
**Depends on**: None
**Status**: Complete (2026-01-22)

---

## New Milestone: v4.0 Estimating System Rebuild

**Milestone Goal:** Replace the current basic estimating system with a professional-grade estimating platform featuring assemblies, client selections, allowances, and proposal generation. Simplify the UI/UX throughout.

**Research Sources:**
- [Buildertrend Estimating](https://buildertrend.com/financial-tools/construction-estimating-software/)
- [CoConstruct Estimating](https://www.coconstruct.com/features/construction-estimating-software)
- [Buildxact Assemblies](https://www.buildxact.com/us/features/construction-estimating-software/)
- [Clear Estimates](https://www.clearestimates.com/)

### Phase 106: Estimating Data Model & Architecture
**Goal**: New database schema for hierarchical estimates with assemblies, sections, and items
**Depends on**: Phase 105
**Requirements**:
  - EST-01: Estimates have sections (Site Work, Framing, Finishes, etc.)
  - EST-02: Sections contain line items with cost codes, quantities, units, costs
  - EST-03: Assemblies are reusable templates that expand into multiple items
  - EST-04: Items can be marked as allowances (placeholder amounts)
  - EST-05: Estimates track markup (overhead %, profit %, contingency %)
  - EST-06: Estimates have versions and status workflow (draft, sent, approved, converted)
**Success Criteria** (what must be TRUE):
  1. Database schema supports estimate → sections → items hierarchy
  2. Assembly templates table exists with template items
  3. Items can reference assemblies (template_id) or be manual entries
  4. Allowance flag distinguishes placeholder vs fixed-price items
  5. Markup calculations (overhead, profit, contingency) apply to estimate totals
  6. Version tracking allows estimate history
**Research**: Complete (106-RESEARCH.md)
**Status**: Complete (2026-01-22)
**Plans**: 2 plans
Plans:
- [x] 106-01-PLAN.md - Database schema: sections, assembly templates, line item extensions
- [x] 106-02-PLAN.md - Database functions and triggers for calculations

### Phase 107: Assembly Library & Estimate Builder
**Goal**: Build and use assembly templates; create estimates with sections and items
**Depends on**: Phase 106
**Requirements**:
  - ASM-01: Admin can create/edit assembly templates (e.g., "Standard Bathroom")
  - ASM-02: Assembly templates contain line items with default quantities and costs
  - ASM-03: User can add assembly to estimate - items auto-populate
  - ASM-04: User can edit assembly-derived items per-job (override defaults)
  - ASM-05: User can add manual line items outside assemblies
  - ASM-06: User can organize items into sections with drag-drop reordering
**Success Criteria** (what must be TRUE):
  1. Assembly Library page exists to manage templates
  2. User can create estimate, add sections, add assemblies or manual items
  3. Adding assembly expands into editable line items
  4. Totals calculate correctly (subtotal + markups = grand total)
  5. Estimate saves and loads properly with all hierarchy
  6. Copy from previous estimate works
**Status**: Complete (2026-01-22)
**Research**: Complete (107-RESEARCH.md)
**Plans**: 3 plans
Plans:
- [x] 107-01-PLAN.md - Assembly Templates API + Assembly Library page
- [x] 107-02-PLAN.md - Estimate Sections API + Sections UI
- [x] 107-03-PLAN.md - Assembly Picker + Copy Estimate

### Phase 108: Selections, Allowances & Client Approval
**Goal**: Mark items as allowances, let clients select options, track variances
**Depends on**: Phase 107
**Requirements**:
  - SEL-01: Items can be marked as allowances with placeholder amount
  - SEL-02: Allowances link to selection categories (lighting, flooring, fixtures)
  - SEL-03: Client can view allowances and make selections from catalog
  - SEL-04: Selection replaces allowance with actual cost
  - SEL-05: Variance tracked (over/under allowance)
  - SEL-06: Client approval workflow for selections
  - SEL-07: Selection changes can trigger change order if post-contract
**Success Criteria** (what must be TRUE):
  1. User can mark any item as allowance with $ amount
  2. Client-facing selection view shows allowances needing selection
  3. Client can pick from catalog or request custom option
  4. Actual cost replaces allowance when selected
  5. Over/under allowance clearly visible
  6. Client can approve selections (digital signature optional)
  7. Selection audit trail maintained
**Research**: Likely (client portal patterns, approval workflows)
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 109: Proposal Generation
**Goal**: Generate professional client-facing proposals from estimates
**Depends on**: Phase 108
**Requirements**:
  - PRO-01: One-click generate PDF proposal from estimate
  - PRO-02: Proposal includes scope descriptions, allowance call-outs
  - PRO-03: Proposal can show line-item detail or summary only
  - PRO-04: Proposal includes payment schedule terms
  - PRO-05: Company branding (logo, contact info) on proposal
  - PRO-06: Client can view proposal via secure link
  - PRO-07: Client can accept proposal (triggers estimate → approved)
**Success Criteria** (what must be TRUE):
  1. Generate Proposal button creates professional PDF
  2. Proposal displays estimate data in client-friendly format
  3. Detail level configurable (line items vs summary)
  4. Allowances clearly marked with selection process explained
  5. Shareable link allows client to view without login
  6. Client acceptance updates estimate status
**Research**: Complete (109-RESEARCH.md)
**Plans**: 3 plans
Plans:
- [ ] 109-01-PLAN.md - Database schema: v2_proposals, v2_company_settings, triggers
- [ ] 109-02-PLAN.md - PDF generator + API routes for proposal CRUD and generation
- [ ] 109-03-PLAN.md - Client view page + acceptance workflow

### Phase 110: Estimating UI/UX Overhaul
**Goal**: Simplify and modernize the estimating interface, remove clutter
**Depends on**: Phase 109
**Requirements**:
  - UX-01: Clean, minimal interface focused on the task at hand
  - UX-02: Remove unnecessary buttons and features
  - UX-03: Intuitive workflow: Create → Build → Review → Send
  - UX-04: Inline editing (click to edit, no modal for every change)
  - UX-05: Keyboard shortcuts for power users
  - UX-06: Mobile-friendly responsive design
  - UX-07: Consistent with rest of application styling
**Success Criteria** (what must be TRUE):
  1. Estimates page is visually clean with clear hierarchy
  2. No unnecessary buttons or confusing options
  3. User can complete common tasks in minimal clicks
  4. Inline editing works for item names, quantities, costs
  5. Keyboard navigation (Tab, Enter, Escape) works intuitively
  6. Works on tablet/mobile for field use
  7. Visual design matches warm light theme
**Status**: Complete (2026-01-22)
**Plans**: 5 plans (all complete)

### Phase 111: Estimate Page Redesign
**Goal**: Restructure estimate page to match Buildertrend's professional layout
**Depends on**: Phase 110
**Requirements**:
  - Single estimate per job (sidebar-driven)
  - Clean header with breadcrumb and inline cost summary
  - Two-tier toolbar (main actions + secondary controls)
  - Professional empty state with clear CTA hierarchy
  - Buildertrend-style button colors and spacing
**Success Criteria** (what must be TRUE):
  1. Header shows "JOB: [Name] / ESTIMATE" breadcrumb
  2. Cost summary displays inline: "Builder cost + Profit (%) = Total price"
  3. Secondary toolbar has Proposal dashboard, Expand all, Jump to search
  4. Empty state matches reference design visually
  5. Page updates when sidebar job selection changes
**Status**: Complete (2026-01-22)
**Plans**: 1 plan (complete)
Plans:
- [x] 111-01-PLAN.md - Estimate page UI restructure to match Buildertrend layout

## Progress

### v3.1 Business Intelligence & Financial Management
| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 78. Financial Foundation | 1 | Complete | 2026-01-20 |
| 79. Expense Tracking | 1 | Complete | 2026-01-20 |
| 80. Employee & Labor Setup | 1 | Complete | 2026-01-20 |
| 81. Digital Timesheets | 1 | Complete | 2026-01-20 |
| 82. Overhead Allocation | 1 | Complete | 2026-01-20 |
| 83. Job Profitability | TBD | Not started | - |
| 84. WIP Schedule | TBD | Not started | - |
| 85. Company P&L | TBD | Not started | - |
| 86. Cash Flow | TBD | Not started | - |
| 87. Business Planning | TBD | Not started | - |
| 105. Estimates Consolidation | 3 | Complete | 2026-01-22 |

### v4.0 Estimating System Rebuild
| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 106. Data Model & Architecture | 2 | Complete | 2026-01-22 |
| 107. Assembly Library & Builder | 3 | Complete | 2026-01-22 |
| 108. Selections & Allowances | 3 | Complete | 2026-01-22 |
| 109. Proposal Generation | 3 | Complete | 2026-01-22 |
| 110. UI/UX Overhaul | 5 | Complete | 2026-01-22 |
| 111. Estimate Page Redesign | 1 | Complete | 2026-01-22 |

---
*Last updated: 2026-01-22*
