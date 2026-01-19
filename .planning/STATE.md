# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Streamline construction financial workflows from bidding through payment
**Current focus:** v1.8 Invoice Variance & Data Linkage

## Current Position

Phase: 48 (Cost Code Linkage) - **IN PROGRESS**
Plan: 1 of 4 complete
Status: 48-01 complete, ready for 48-02/48-03/48-04
Last activity: 2026-01-19 - Completed 48-01-PLAN.md (PO Line Item Validation Warnings)

Progress: 1/4 Phase 48 plans complete

### Phase 48 Plans

| Plan | Name | Wave | Status |
|------|------|------|--------|
| 48-01 | PO Line Item Validation Warnings | 1 | **Complete** |
| 48-02 | Enhanced AI Cost Code Suggestion | 1 | Ready |
| 48-03 | Improved Line Item Matching | 1 | Ready |
| 48-04 | G703 Validation Endpoint | 2 | Ready |

## Milestone History

- **v1.8 Invoice Variance & Data Linkage** (active): 5 phases (47-51), 17 requirements
- **v1.7 Data Integrity & AI Accuracy** (shipped 2026-01-19): 4 phases (43-46), 16 plans - Budget RPC, Invoice pipeline, Draw/PO linking, AI accuracy
- **v1.6 Module Expansion** (shipped 2026-01-19): 6 phases, 17 plans - Leads/CRM, Selections, 7 scaffold modules, navigation reorganization
- **v1.5 UI Cleanup** (shipped 2026-01-18): 7 phases, 19 plans - CSS standardization, component uniformity
- **v1.4 Price Intelligence** (2026-01-18): Price tracking, order optimization, savings analytics, PO warnings
- **v1.3 Refinement** (2026-01-18): Invoice AI improvements, Financial reports (JSON, Excel, PDF)
- **v1.2 Gap Fixes** (2026-01-18): Error handling, Jobs, Vendors, Budgets, Schedules, Documents
- **v1.1 Field Features** (2026-01-17): Bids, Estimates, Photos, Dashboard, UX Polish
- **v1.0 Core Platform** (2026-01-17): Invoices, POs, Draws, Logs, Inspections, Punch Lists

## Accumulated Context

### Decisions

- **No retainage**: User explicitly excluded retainage calculations
- **Audit-driven scope**: v1.7 requirements derived from comprehensive system audit
- **RPC for budget atomicity**: increment/decrement functions for committed_amount
- **Best-effort rollback**: Manual state tracking since Supabase JS lacks transactions
- **VPO quick adds**: v1.8 includes verbal purchase orders for quick additional work authorization
- **47-01**: Show only "Create CO" button if description suggests change order, otherwise show both "Quick VPO" and "Create CO"
- **47-01**: Auto-approve COs created from variance (status='approved') since they resolve known variance
- **47-01**: Refresh invoice via openInvoice() after VPO/CO creation to update variance banner
- **47-02**: Added ABBREVIATIONS constant for construction term expansion in text matching (expandAbbreviations=true by default)
- **48-03**: 85% similarity threshold for fuzzy word matching catches typos like "instalation" -> "installation"
- **48-03**: Cost code match adds 0.15 boost to line item matching score
- **48-03**: Partial billing (invoice < PO) gets 0.5-0.9 amount score based on billed ratio
- **48-01**: Warning returns max 5 item descriptions to avoid oversized responses
- **48-01**: Warning object structure: { type, severity, count, items, message }

### Pending Todos

None

### Blockers/Concerns

None

## Session Continuity

Last session: 2026-01-19
Stopped at: Completed 48-01-PLAN.md (PO Line Item Validation Warnings)
Resume file: None

## Next Actions

1. Run `/gsd:execute-phase 48` to execute Cost Code Linkage phase

## Research

- v1.7 audit findings fully addressed
- VPO database migration and API already implemented (migration-065-vpo.sql)
- VPO UI added to PO modal
- Variance detector service exists (server/services/varianceDetector.js)
- Variance action buttons now complete - users can create VPO/CO from invoice modal
- Variance detector has 35 unit tests and documented thresholds
- Phase 48 research complete - existing similarity functions can be reused (levenshteinDistance, similarityRatio)
