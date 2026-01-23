# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Run your entire construction business from one intelligent system
**Current focus:** Phase 112 Fix Estimates Functionality - COMPLETE

## Current Position

Phase: 112 (Fix Estimates Functionality)
Plan: 2 of 2
Status: COMPLETE
Last activity: 2026-01-22 - Completed Phase 112-02

Progress: [██████████] 100% (2 of 2 plans complete)

## Performance Metrics

**Phase 112 (Fix Estimates Functionality - COMPLETE):**
- Plan 112-01: Bug fixes for estimate creation and display (completed)
- Plan 112-02: Estimate hierarchy database schema (already existed via migration-117)
- **Total Duration:** ~5 min (verification only)
- **Output:** Confirmed estimate hierarchy schema exists, documented in 112-02-SUMMARY.md

**Phase 111 (Estimate Page Redesign - COMPLETE):**
- Plan 111-01: Estimate page UI restructure (completed, 18 min)
- **Total Duration:** ~18 min
- **Output:** Professional Buildertrend-style layout with breadcrumb, inline cost summary, blue buttons

**Phase 110 (UI/UX Overhaul - COMPLETE):**
- Plan 110-01: Interface cleanup and dropdown menus (completed, 35 min)
- Plan 110-02: Inline line item editing (completed, 15 min)
- Plan 110-03: Workflow stepper (completed, 15 min)
- Plan 110-04: Keyboard shortcuts (completed, 10 min)
- Plan 110-05: Mobile responsive design (completed, 8 min)
- **Total Duration:** ~83 min
- **Output:** Full UI overhaul with keyboard shortcuts, mobile responsive, workflow stepper, inline editing

**Phase 109 (Proposal Generation - COMPLETE):**
- Plan 109-01: Database schema for proposals (completed, 5 min)
- Plan 109-02: PDF generator + API routes (completed, 12 min)
- Plan 109-03: Client-facing view + acceptance (completed, 10 min)
- Staff UI: Estimate page integration (completed, 8 min)
- **Total Duration:** ~35 min
- **Output:** Professional PDF proposals, secure sharing, client acceptance workflow

**Phase 108 (Selections & Allowances - COMPLETE):**
- Plan 108-01: Estimate-to-Selections Bridge schema (completed, 5 min)
- Plan 108-02: API routes for client approval (completed, 10 min)
- Plan 108-03: Client-facing selection approval UI (completed, 15 min)
- **Total Duration:** ~30 min

**Phase 107 (Assembly Library - COMPLETE):**
- Plan 107-01: Assembly Library admin page (completed, 8 min)
- Plan 107-02: Section Management (completed, 12 min)
- Plan 107-03: Assembly Picker Workflow (completed, 25 min)
- **Total Duration:** ~45 min

**Phase 106 (Estimating Data Model - COMPLETE):**
- Plan 106-01: Database schema (completed, 3 min)
- Plan 106-02: Functions and triggers (completed, 4 min)
- **Total Duration:** ~7 min

**Phase 105 (Estimates & Budget Consolidation - COMPLETE):**
- Plan 105-01: Unified estimates-budget page (completed)
- Plan 105-02: Navigation and redirects (completed)
- Plan 105-03: URL mode handling (completed)
- **Total Duration:** ~15 min


**Phase 104 (Application Reorganization - COMPLETE):**
- Plan 104-01: Navigation context architecture (completed, 5 min)
- Plan 104-02: Job sidebar context awareness (completed, 5 min)
- Plan 104-03: Job-context page attributes (completed, 3 min)
- Plan 104-04: Company-context page attributes (completed, 2 min)
- Plan 104-05: Visual context indicator (completed, 3 min)
- **Total Duration:** ~18 min

**Phase 103 (Data Integrity Audit - COMPLETE):**
- Plan 103-01: Audit all pages for hardcoded values (completed, 8 min)
- Plan 103-02: Budget data integrity verification (completed, 8 min)
- Plan 103-03: Draws G702/G703 data integrity (completed, 10 min)
- Plan 103-04: Dashboard/Employees stat card verification (completed, 3 min)
- Plan 103-04b: Expenses/Schedule/Timesheets stat card verification (completed, 4 min)
- Plan 103-05: RFIs, Submittals, Closeout user references (completed, 5 min)
- Plan 103-05b: Warranties, Tasks, Daily Logs user references (completed, 5 min)
- Plan 103-06: Final verification and audit report (completed, 5 min)
- **Total Duration:** ~48 min

**Phase 102 (Schedule UI Overhaul - completed):**
- Plan 102-01: Backend baseline APIs (Wave 1)
- Plan 102-02: Backend template APIs (Wave 1)
- Plan 102-03: Baseline and template UI (Wave 2)
- Plan 102-04: Task editing workflow (Wave 2)
- Duration: ~30 minutes

**Phase 101 (Research - completed):**
- Plan 101-01: 1 plan, completed
- Duration: 3 minutes
- Output: 101-DOCUMENTATION.md (599 lines)

**v3.1 Milestone (in progress):**
- Phase 78: 1 plan, completed
- Phase 79: 1 plan, completed
- Phase 80: 1 plan, completed
- Phase 81: 1 plan, completed
- Phase 82: 1 plan, completed

**v3.0 Milestone (completed):**
- Phases: 9 (70-77)
- Plans: 15
- Duration: 14 days

## Accumulated Context

### Decisions

Key decisions for v3.1:
- % of Labor Hours as primary allocation method
- Role-based access within same app (not separate admin portal)
- Integrate with existing job/invoice/PO/draw data
- Burden rates stored as decimals (0.0765 = 7.65%)
- Priority cascade for burden rate: custom > class > company default
- Timesheet costs auto-calculated with burden via triggers
- Overhead rate = Total Overhead / Total Labor Hours
- Rolling 12-month average for stable rate

**Phase 101 Scheduling Research Decisions:**
- Gap priorities: P1 = Baseline schedules, Templates UI, Bulk ops, Notifications
- Phase 102 scope: Baseline + Templates + Bulk ops + Agenda view
- Implementation order: DB migrations -> Baseline -> Templates -> Bulk ops -> Agenda

**Phase 103 Data Integrity Audit Decisions (FINAL):**
- 0 critical data integrity issues found
- 54 hardcoded user references ('Jake Ross') identified
- 21 user references fixed with window.currentUser pattern
- 33 user references deferred to Phase 94 (auth system)
- All stat cards properly load from API endpoints
- Budget page verified: contract_amount loads from database
- User context pattern: window.currentUser || 'User'
- Added verifyBudgetIntegrity() for client-side validation
- Added verifyDrawIntegrity() for G702/G703 validation
- Dashboard/Employees/Expenses/Schedule/Timesheets all verified data-driven
- VERIFICATION-CHECKLIST.md created for deployment validation

**Phase 104 Application Reorganization Decisions (COMPLETE):**
- Dual-context navigation: navContexts with job/company hierarchical structure
- detectPageContext() priority: data-page-context > URL matching
- 48 total pages classified: 29 job-context, 19 company-context
- Sidebar disabled on company-context pages via init() check
- Graceful API degradation: onJobChange, getSelectedJobId, getSelectedJob return empty on company pages
- Page groups: job-finance, precon, active, closeout, company-finance, resources, team, overview
- Role minimums set for future RBAC: owner(5), admin(4), pm(3), accounting(3), supervisor(2.5), field_crew(2), client(1.5), designer(1.5)
- Visual context indicator: pill-shaped badge with icon + switch button
- Context switching: Job View -> dashboard.html, Company View -> job-hub.html

**Phase 106 Estimating Data Model Decisions (COMPLETE):**
- Section deletion uses ON DELETE SET NULL - items remain but unassigned
- Assembly templates are reusable (not per-estimate) with template_id tracing
- Version snapshots use JSONB with pre-computed totals for quick comparison
- Markup calculation order: subtotal -> overhead (on subtotal) -> profit (on subtotal+overhead) -> contingency (on subtotal)
- Status constraint includes 'sent' for client delivery workflow
- Legacy markup_percent supported for backward compatibility
- Assembly children excluded from totals (parent_line_id IS NULL filter)
- Triggers cascade: line change -> section subtotal -> estimate totals -> assembly header

**Phase 111 Estimate Page Redesign Decisions (COMPLETE):**
- Single estimate per job - sidebar controls which job's estimate is shown (no job filter needed)
- Buildertrend-style layout with two-tier header/toolbar structure
- Inline cost summary: "Builder cost + Profit (%) = Total price" for quick visibility
- Professional empty state with clear action hierarchy and import options
- Clean spacing and button styling matching Buildertrend reference design
- Breadcrumb format with uppercase: "JOB: [NAME] / ESTIMATE"
- Buildertrend blue (#2E6BE5) for primary actions
- "IMPORT FROM" label for better UX hierarchy

**Phase 110 UI/UX Overhaul Decisions (COMPLETE):**
- Removed card view entirely - table view provides better information density for construction data
- Dropdown menu pattern established using .dropdown, .dropdown-toggle, .dropdown-menu classes
- Progressive disclosure: secondary actions moved to overflow menus
- Preserved proposal generation feature (fully implemented in Phase 109)
- Future feature toasts reference specific phases (107, 108, 110-02) instead of generic "coming soon"
- 44px minimum touch targets for mobile usability
- Keyboard shortcuts mimic spreadsheet behavior (Tab/Enter navigation)

**Phase 108 Selections & Allowances Decisions (COMPLETE):**
- estimate_line_id uses ON DELETE SET NULL - allowance persists if estimate line deleted
- Client approval tracked separately from admin approval (5 new columns)
- convert_estimate_allowances() is idempotent - safe to call multiple times
- Category matching uses fuzzy match on cost code name with fallback to 'Other'
- Role-based filtering: client role cannot see internal_notes
- Post-contract detection: jobs in construction/in_progress/active/closed/complete trigger CO prompt

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-22
Stopped at: Completed Phase 110-01 (UI cleanup)
Resume file: None

## Next Actions

Phase 112 complete. Ready for next phase.

## Milestone History

- **Phase 112-02 Estimate Hierarchy Schema** (completed 2026-01-22): Verified estimate hierarchy database schema exists (migration-117 already applied in Phase 106), documented 4-level hierarchy structure (Phases > Groups > Subgroups > Line Items), template system with seed data

- **Phase 112-01 Fix Estimates Functionality** (completed 2026-01-22): Fixed critical bugs (auto-calculation event listeners, create estimate modal), added comprehensive debug logging throughout initialization flow, ready for production testing

- **Phase 111-01 Estimate Page Redesign** (completed 2026-01-22): Buildertrend-style layout with breadcrumb, inline cost summary, professional blue buttons, clean spacing

- **Phase 110-05 Mobile Responsive Design** (completed 2026-01-22): Touch-friendly card view for phones/tablets

- **Phase 110-04 Keyboard Shortcuts** (completed 2026-01-22): Power user navigation with Tab/Enter/Escape

- **Phase 110-03 Workflow Stepper** (completed 2026-01-22): Visual Create → Build → Review → Send progression

- **Phase 110-02 Inline Line Item Editing** (completed 2026-01-22): Click-to-edit cells with keyboard navigation (Tab/Enter/Escape), debounced autosave, automatic amount recalculation

- **Phase 110-01 UI/UX Cleanup** (completed 2026-01-22): Removed interface clutter, added dropdown menus, simplified modal tabs

- **Phase 109 Proposal Generation** (completed 2026-01-22): PDF proposals, secure sharing, client acceptance workflow

- **Phase 108 Selections & Allowances** (completed 2026-01-22): Estimate-to-selections bridge, client approval API, approval UI

- **Phase 107 Assembly Library** (completed 2026-01-22): Assembly templates, Section management, Assembly picker workflow

- **Phase 106 Estimating Data Model** (completed 2026-01-22): Database schema, functions, and triggers for estimates v4.0

- **Phase 105 Estimates & Budget Consolidation** (completed 2026-01-21): Unified estimates-budget.html, navigation consolidation, redirect stubs, URL mode handling

- **Phase 104 Application Reorganization** (completed 2026-01-21): Context-aware navigation, sidebar, 48 pages with data attributes, visual context indicator
- **Phase 103 Data Integrity Audit** (completed 2026-01-21): Audit and fix hardcoded values, all stat cards verified
- **Phase 101 Research** (completed 2026-01-21): Buildertrend competitive analysis
- **v3.1 Business Intelligence & Financial Management** (in progress): Started 2026-01-20
- **v3.0 Smart Catalog & Estimation Engine** (shipped 2026-01-20): 9 phases (70-77)
- **v2.1 Selections & Navigation Polish** (shipped 2026-01-20): 5 phases (65-69)
- **v2.0 Business Operating System** (shipped 2026-01-19): 8 phases (57-64)
