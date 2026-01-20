# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Streamline construction financial workflows from bidding through payment
**Current focus:** v1.8 Invoice Variance & Data Linkage

## Current Position

Phase: 51 (Quick Fixes) - **IN PROGRESS**
Plan: 3 of 4 complete
Status: Wave 1 complete (51-01, 51-03), Wave 2 in progress (51-02 complete)
Last activity: 2026-01-19 - Completed 51-02 Fix Modal UI Component

Progress: 3/4 Phase 51 plans complete

### Phase 51 Plans

| Plan | Name | Wave | Status |
|------|------|------|--------|
| 51-01 | Fix Endpoints with Auto-Correction | 1 | Complete |
| 51-02 | Fix Modal UI Component | 2 | Complete |
| 51-03 | Enhanced Error Messages with Actionable Guidance | 1 | Complete |
| 51-04 | Bulk Fix Operations UI | 2 | Pending |

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
- **48-01**: Warning returns max 5 item descriptions to avoid oversized responses
- **48-01**: Warning object structure: { type, severity, count, items, message }
- **48-04**: Validation returns errors (block submission) and warnings (informational only)
- **48-04**: Submit flow fails with 400 if any allocation lacks budget line
- **49-02**: 0.01 threshold for discrepancy detection (floating point tolerance)
- **49-02**: VPOs tracked as warnings (not errors) since they may intentionally not be in totals
- **49-02**: Batch validation fetches all data in parallel for efficiency
- **49-03**: 10% threshold for price warnings, 25% for high severity
- **49-03**: Confidence >= 3 (0.6) filter for price data reliability
- **49-03**: Price comparison runs for both PO-linked and non-PO invoices
- **49-04**: Over-committed and over-billed are errors, approaching 90% is warning
- **49-04**: VPOs tracked at job level only (no cost code line items)
- **50-02**: Cost code matching priority: learned_pattern (0.80-0.99) > keyword (0.75) > trade_default (0.60)
- **50-02**: Learned patterns boost confidence by 0.01 per usage up to 0.99 max
- **50-03**: Job matching includes on_hold jobs (not just active) for comprehensive search
- **50-03**: Fuzzy matching thresholds: 0.8 for client name, 0.7 for address street, 0.85 for vendor
- **50-03**: Returns alternates (top 2) for both job and vendor matches for user selection
- **51-03**: Standardized validation error structure: { type, severity, message, fix_hint, details }
- **51-03**: createDetailedFixHint() generates context-aware hints with specific amounts

### Pending Todos

None

### Blockers/Concerns

None

## Session Continuity

Last session: 2026-01-19
Stopped at: Completed 51-02-PLAN.md (Fix Modal UI Component)
Resume file: None

## Next Actions

1. Execute Plan 51-04 (Bulk Fix Operations UI) - Wave 2

## Research

- v1.7 audit findings fully addressed
- VPO database migration and API already implemented (migration-065-vpo.sql)
- VPO UI added to PO modal
- Variance detector service exists (server/services/varianceDetector.js)
- Variance action buttons now complete - users can create VPO/CO from invoice modal
- Variance detector has 35 unit tests and documented thresholds
- Phase 48 research complete - existing similarity functions can be reused (levenshteinDistance, similarityRatio)
