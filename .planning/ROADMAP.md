# Roadmap: Ross Built CMS v3.0 Smart Catalog & Estimation Engine

## Overview

Transform Ross Built CMS from a construction management tool into a data-driven estimation and intelligence platform. Starting with enhanced catalog data (labor, durations, dependencies), building up through construction knowledge and trade scorecards, then enabling selection-driven estimation that auto-generates schedules and converts downstream to bids/POs. Document intelligence enriches all systems, and feedback loops make the system smarter with use.

## Milestones

- [Archive: .planning/milestones/] v1.0-v2.0 (shipped)
- [x] **v2.1 Selections & Navigation Polish** - Phases 65-69 (shipped 2026-01-20)
- [ ] **v3.0 Smart Catalog & Estimation Engine** - Phases 70-76 (in progress)

## Phases

**Phase Numbering:**
- Continues from v2.1 (ended at Phase 69)
- Integer phases (70, 71, 72): Planned milestone work
- Decimal phases (70.1, 70.2): Urgent insertions (marked with INSERTED)

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

### v3.0 Smart Catalog & Estimation Engine (In Progress)

**Milestone Goal:** Build data infrastructure that turns selections into estimates, schedules, and downstream documents. Every piece of information flows to all relevant systems, and actuals feed back to improve future predictions.

- [x] **Phase 70: Smart Catalog Foundation** - Enhanced catalog with labor/duration/lead time/dependency data
- [ ] **Phase 70.1: AI Document Intelligence Hub** - INSERTED: Foundational AI processing that routes document data everywhere
- [ ] **Phase 71: Construction Knowledge Base** - Warnings, quality checks, pre-reqs attached to catalog items
- [ ] **Phase 72: Selection-Driven Estimation** - Pick selections, auto-calculate costs with material + labor
- [ ] **Phase 73: Schedule Intelligence** - Generate timeline from selections + dependencies
- [ ] **Phase 74: Trade Scorecards** - Quality/speed/reliability metrics for trades and vendors
- [ ] **Phase 75: Document Intelligence** - AI parsing routes to all systems
- [ ] **Phase 76: Feedback Loops** - Actuals update catalog pricing and duration estimates
- [ ] **Phase 77: UI Consistency** - Remove old upload buttons, add sidebar to all job-specific pages

## Phase Details

### Phase 70: Smart Catalog Foundation
**Goal**: Catalog items contain all data needed for estimation and scheduling (labor, duration, dependencies, permits, warranties)
**Depends on**: Phase 69 (v2.1 complete)
**Requirements**: CAT-ENH-01, CAT-ENH-02, CAT-ENH-03, CAT-ENH-04, CAT-ENH-05, CAT-ENH-06, CAT-ENH-07, CAT-ENH-08
**Success Criteria** (what must be TRUE):
  1. Staff can view/edit labor hours, install duration, and lead time for any catalog item
  2. Staff can set waste factor and coverage rate for materials
  3. Staff can assign quality tier (builder/standard/premium) to items
  4. Staff can link catalog items to compatible trades and see their rates
  5. Staff can define dependency relationships (what must happen before/after installation)
**Plans**: TBD

Plans:
- [ ] 70-01: Catalog schema enhancement (labor, duration, lead time, waste, coverage, tier)
- [ ] 70-02: Trade linking and dependency relationships
- [ ] 70-03: Permit flags, rough-in requirements, warranty terms

### Phase 70.1: AI Document Intelligence Hub (INSERTED)
**Goal**: Foundational AI infrastructure that processes any uploaded document and intelligently routes extracted data to ALL relevant systems
**Depends on**: Phase 70 (catalog fields exist to populate)
**Requirements**: AI-HUB-01, AI-HUB-02, AI-HUB-03, AI-HUB-04, AI-HUB-05, AI-HUB-06, AI-HUB-07, AI-HUB-08, AI-HUB-09, AI-HUB-10
**Success Criteria** (what must be TRUE):
  1. Staff can upload any document (invoice, quote, proposal, spec sheet, delivery receipt, warranty doc)
  2. AI classifies document type and extracts all relevant data in one pass
  3. Extracted data routes to Invoices system (vendor, amounts, line items, job matching)
  4. Extracted data routes to Catalog (new products, specs, labor estimates)
  5. Extracted data routes to Price Intelligence (vendor pricing, price history)
  6. Extracted data routes to Schedule (lead times, delivery dates, duration actuals)
  7. Extracted data routes to Knowledge Base (warnings, specs, warranty terms)
  8. Extracted data routes to Daily Logs (delivery tracking, crew info)
  9. Extracted data routes to Trade Scorecards (delivery performance, quality indicators)
  10. Staff can review AI extractions and confirm/edit before final commit
**Plans**: TBD

Plans:
- [ ] 70.1-01: Document upload queue and AI classification engine
- [ ] 70.1-02: Universal extraction pipeline (Claude API with system context)
- [ ] 70.1-03: Multi-destination routing engine
- [ ] 70.1-04: Review/confirm UI for extracted data
- [ ] 70.1-05: Consolidate existing AI processors (invoices, daily logs) into hub


### Phase 71: Construction Knowledge Base
**Goal**: Every catalog selection carries installation warnings, quality checks, and tribal knowledge that feeds downstream operations
**Depends on**: Phase 70
**Requirements**: KNOW-01, KNOW-02, KNOW-03, KNOW-04, KNOW-05, KNOW-06, KNOW-07, KNOW-08
**Success Criteria** (what must be TRUE):
  1. Staff can add/view installation warnings and pre-installation requirements per catalog item
  2. Staff can define quality check lists and inspection points per item
  3. Staff can capture common defect patterns (punch list suggestions) per item
  4. Knowledge base auto-suggests punch list items based on room selections
  5. Knowledge sharing works across similar selections (LVP knowledge applies to all LVP)
**Plans**: TBD

Plans:
- [ ] 71-01: Knowledge schema and CRUD (warnings, checks, pre-reqs, defects)
- [ ] 71-02: Knowledge integration with punch lists and inspections
- [ ] 71-03: Cross-selection knowledge sharing

### Phase 72: Selection-Driven Estimation
**Goal**: Staff picks selections from catalog, enters house details, and system calculates material + labor costs automatically
**Depends on**: Phase 70, Phase 71
**Requirements**: EST-BLD-01, EST-BLD-02, EST-BLD-03, EST-BLD-04, EST-BLD-05, EST-BLD-06, FLOW-01, FLOW-02, FLOW-03, FLOW-04
**Success Criteria** (what must be TRUE):
  1. Staff can create an estimate by selecting products from the enhanced catalog
  2. Staff can enter house details (sqft, rooms, dimensions) that drive quantity calculations
  3. System auto-calculates material quantities using dimensions and coverage rates
  4. System auto-calculates total costs (material qty x price x waste factor + labor hours x rate)
  5. Staff can override any calculated value and save versioned estimates
  6. Staff can convert estimate to allowance budgets, scopes, bid requests, and POs
**Plans**: TBD

Plans:
- [ ] 72-01: Estimate builder UI with selection picker
- [ ] 72-02: House details and quantity calculation engine (decimal.js)
- [ ] 72-03: Cost calculation, overrides, and estimate versioning
- [ ] 72-04: Downstream conversion (allowances, scopes, bids, POs)

### Phase 73: Schedule Intelligence
**Goal**: System generates project timeline from estimate selections using durations, dependencies, and lead times
**Depends on**: Phase 70, Phase 72
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05
**Success Criteria** (what must be TRUE):
  1. Staff can generate a schedule from an estimate's selections
  2. Schedule sequences trades correctly based on catalog dependencies (toposort)
  3. Long lead time items (cabinets, appliances) are flagged and factored into start dates
  4. Critical path is visible and highlighted in the schedule view
  5. Schedule accounts for cure times (concrete, paint) and inspection holds
**Plans**: TBD

Plans:
- [ ] 73-01: Schedule generation engine (toposort, date-fns)
- [ ] 73-02: Lead time and cure time handling
- [ ] 73-03: Gantt visualization with critical path (Frappe Gantt)

### Phase 74: Trade Scorecards
**Goal**: Trades and vendors have quantified performance scores (quality, speed, reliability) that inform recommendations
**Depends on**: Phase 70
**Requirements**: TRADE-01, TRADE-02, TRADE-03, TRADE-04
**Success Criteria** (what must be TRUE):
  1. Staff can view trade/vendor scorecards with cost, quality, speed, and reliability scores
  2. Staff can track trade capacity and availability windows
  3. Completed work updates trade performance scores automatically
  4. System recommends trades based on job requirements and past performance
**Plans**: TBD

Plans:
- [ ] 74-01: Trade scorecard schema and display
- [ ] 74-02: Performance event tracking and score aggregation
- [ ] 74-03: Capacity tracking and trade recommendations

### Phase 75: Document Intelligence
**Goal**: Upload any document (proposal, quote, spec sheet) and AI extracts data that routes to all relevant systems
**Depends on**: Phase 70, Phase 71, Phase 72, Phase 73, Phase 74
**Requirements**: DOC-INT-01, DOC-INT-02, DOC-INT-03, DOC-INT-04, DOC-INT-05, DOC-INT-06, DOC-INT-07
**Success Criteria** (what must be TRUE):
  1. Staff can upload proposals/quotes and AI extracts products, prices, lead times, specs
  2. Extracted products route to catalog (create new or update existing)
  3. Extracted prices update price intelligence with vendor-specific pricing
  4. Extracted lead times update schedule calculations
  5. Permit requirements, rough-in needs, and warranty terms are captured and routed
**Plans**: TBD

Plans:
- [ ] 75-01: Document queue and AI extraction pipeline (Claude API)
- [ ] 75-02: Routing engine to catalog, pricing, and schedule systems
- [ ] 75-03: Permit, rough-in, and warranty extraction routing

### Phase 76: Feedback Loops
**Goal**: Actuals from operations (invoices, delivery dates, durations, trade performance) flow back to improve catalog predictions
**Depends on**: Phase 70, Phase 72, Phase 73, Phase 74
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04, FEED-05
**Success Criteria** (what must be TRUE):
  1. Invoice actuals automatically suggest updates to catalog pricing (with approval)
  2. Actual delivery dates update lead time estimates in the catalog
  3. Actual installation durations update labor/duration estimates
  4. Trade performance from completed jobs updates scorecard metrics
  5. Warranty claims flag problematic products in the catalog
**Plans**: TBD

Plans:
- [ ] 76-01: Price feedback from invoices
- [ ] 76-02: Duration and lead time feedback from actuals
- [ ] 76-03: Trade scorecard updates and warranty claim tracking

### Phase 77: UI Consistency
**Goal**: Unified navigation experience - global AI Upload replaces page-specific buttons, all job-related pages have sidebar filtering
**Depends on**: Phase 76
**Requirements**: UI-CON-01, UI-CON-02, UI-CON-03
**Success Criteria** (what must be TRUE):
  1. No page-specific upload buttons exist (global AI Upload FAB handles all uploads)
  2. All job-specific pages (inspections, permits, crew-schedule, contracts) have sidebar with job filtering
  3. Admin/cross-job pages (vendors, companies, contacts, business-dashboard) correctly lack sidebar
  4. Navigation structure is consistent across all 40+ pages
**Plans**: TBD

Plans:
- [x] 77-01: Remove old upload buttons (index.html, pos.html, documents.html)
- [x] 77-02: Add sidebar to job-specific pages (inspections, permits, crew-schedule, contracts)
- [x] 77-03: Verify and document page organization

## Progress

**Execution Order:** Phases execute in numeric order: 70 -> 70.1 -> 71 -> 72 -> 73 -> 74 -> 75 -> 76 -> 77

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 70. Smart Catalog Foundation | 5/5 | Complete | 2026-01-20 |
| 70.1 AI Document Intelligence Hub | 0/5 | Not Started | - |
| 71. Construction Knowledge Base | 0/3 | Not Started | - |
| 72. Selection-Driven Estimation | 0/4 | Not Started | - |
| 73. Schedule Intelligence | 0/3 | Not Started | - |
| 74. Trade Scorecards | 0/3 | Not Started | - |
| 75. Document Intelligence | 0/3 | Not Started | - |
| 76. Feedback Loops | 0/3 | Not Started | - |
| 77. UI Consistency | 3/3 | Complete | 2026-01-20 |

## Requirement Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| CAT-ENH-01 | 70 | Labor hours, install duration, lead time fields |
| CAT-ENH-02 | 70 | Waste factor and coverage rate |
| CAT-ENH-03 | 70 | Quality tier (builder/standard/premium) |
| CAT-ENH-04 | 70 | Link to compatible trades |
| CAT-ENH-05 | 70 | Permit requirement flags |
| CAT-ENH-06 | 70 | Rough-in requirements |
| CAT-ENH-07 | 70 | Dependency relationships (before/after) |
| CAT-ENH-08 | 70 | Warranty terms |
| AI-HUB-01 | 70.1 | Single upload endpoint accepts any document type |
| AI-HUB-02 | 70.1 | AI classifies document type automatically |
| AI-HUB-03 | 70.1 | Universal extraction with full system context |
| AI-HUB-04 | 70.1 | Route to Invoices (amounts, vendor, job, PO matching) |
| AI-HUB-05 | 70.1 | Route to Catalog (products, specs, labor estimates) |
| AI-HUB-06 | 70.1 | Route to Price Intelligence (pricing history) |
| AI-HUB-07 | 70.1 | Route to Schedule (lead times, delivery dates) |
| AI-HUB-08 | 70.1 | Route to Knowledge Base (warnings, warranty) |
| AI-HUB-09 | 70.1 | Route to Daily Logs and Trade Scorecards |
| AI-HUB-10 | 70.1 | Review/confirm UI before commit |
| KNOW-01 | 71 | Installation warnings |
| KNOW-02 | 71 | Quality check lists |
| KNOW-03 | 71 | Pre-installation requirements |
| KNOW-04 | 71 | Inspection points |
| KNOW-05 | 71 | Common defect patterns |
| KNOW-06 | 71 | Knowledge feeds punch list suggestions |
| KNOW-07 | 71 | Knowledge feeds inspection checklists |
| KNOW-08 | 71 | Knowledge sharing across similar selections |
| EST-BLD-01 | 72 | Create estimate from catalog selections |
| EST-BLD-02 | 72 | Enter house details (sqft, rooms, dimensions) |
| EST-BLD-03 | 72 | Auto-calculate material quantities |
| EST-BLD-04 | 72 | Auto-calculate costs (material + labor) |
| EST-BLD-05 | 72 | Fine-tune with overrides |
| EST-BLD-06 | 72 | Save and version estimates |
| FLOW-01 | 72 | Convert estimate to allowance budgets |
| FLOW-02 | 72 | Generate scopes of work from estimate |
| FLOW-03 | 72 | Create bid requests from scopes |
| FLOW-04 | 72 | Convert approved bids to POs |
| SCHED-01 | 73 | Generate schedule from estimate selections |
| SCHED-02 | 73 | Sequence trades by dependencies |
| SCHED-03 | 73 | Factor lead times into schedule |
| SCHED-04 | 73 | Show critical path |
| SCHED-05 | 73 | Account for cure times and inspections |
| TRADE-01 | 74 | Trade/vendor records with scores |
| TRADE-02 | 74 | Trade capacity and availability tracking |
| TRADE-03 | 74 | Performance updates from completed work |
| TRADE-04 | 74 | Trade recommendations based on requirements |
| DOC-INT-01 | 75 | AI parses uploaded proposals/quotes |
| DOC-INT-02 | 75 | Parsed data routes to catalog |
| DOC-INT-03 | 75 | Parsed data routes to price intelligence |
| DOC-INT-04 | 75 | Parsed data routes to schedule (lead times) |
| DOC-INT-05 | 75 | Parsed data flags permit requirements |
| DOC-INT-06 | 75 | Parsed data captures rough-in requirements |
| DOC-INT-07 | 75 | Parsed data captures warranty terms |
| FEED-01 | 76 | Invoice actuals update catalog pricing |
| FEED-02 | 76 | Actual delivery dates update lead times |
| FEED-03 | 76 | Actual durations update install time estimates |
| FEED-04 | 76 | Trade performance updates scorecards |
| FEED-05 | 76 | Warranty claims flag products |
| UI-CON-01 | 77 | Remove page-specific upload buttons (global FAB handles all) |
| UI-CON-02 | 77 | Add sidebar to job-specific pages missing it |
| UI-CON-03 | 77 | Document page organization (job-specific vs admin) |

**Coverage:** 59/59 requirements mapped (46 original + 10 AI-HUB + 3 UI-CON requirements)

---
*Roadmap created: 2026-01-20*
*Last updated: 2026-01-20*
*Phase 70.1 inserted: 2026-01-20*
