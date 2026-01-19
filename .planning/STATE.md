# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Streamline construction financial workflows from bidding through payment
**Current focus:** v1.7 Data Integrity & AI Accuracy

## Current Position

Phase: 44 of 4 (invoice-pipeline)
Plan: 1 of 4 in current phase
Status: In progress
Last activity: 2026-01-19 — Completed 44-02-PLAN.md (Allocation Sum Validation)

Progress: [============----] 4/12 plans (v1.7)

## Milestone History

- **v1.7 Data Integrity & AI Accuracy** (active): 4 phases planned (43-46) — Budget RPC, Invoice pipeline, Draw/PO linking, AI accuracy
- **v1.6 Module Expansion** (shipped 2026-01-19): 6 phases, 17 plans — Leads/CRM, Selections, 7 scaffold modules, navigation reorganization
- **v1.5 UI Cleanup** (shipped 2026-01-18): 7 phases, 19 plans — CSS standardization, component uniformity
- **v1.4 Price Intelligence** (2026-01-18): Price tracking, order optimization, savings analytics, PO warnings
- **v1.3 Refinement** (2026-01-18): Invoice AI improvements, Financial reports (JSON, Excel, PDF)
- **v1.2 Gap Fixes** (2026-01-18): Error handling, Jobs, Vendors, Budgets, Schedules, Documents
- **v1.1 Field Features** (2026-01-17): Bids, Estimates, Photos, Dashboard, UX Polish
- **v1.0 Core Platform** (2026-01-17): Invoices, POs, Draws, Logs, Inspections, Punch Lists

## Accumulated Context

### Decisions

- **No retainage**: User explicitly excluded retainage calculations from v1.7 scope
- **Audit-driven scope**: v1.7 requirements derived from comprehensive system audit

### Audit Findings (2026-01-19)

Critical issues identified:
1. ~~`increment_committed_amount` RPC function called but never created~~ FIXED (43-01)
2. ~~Budget lines created with $0 budgeted_amount when invoice allocated~~ FIXED (43-03)
3. No allocation cleanup on invoice denial/deletion
4. Draw totals stored but not always recalculated
5. Job matching confidence threshold too low (50%)

### Phase 43 Decisions

- **increment raises exception if budget line missing**: Prevents committing to non-existent budget lines
- **decrement is no-op for missing budget lines**: Voiding PO succeeds even if budget line was deleted
- **RPC failures logged but don't fail operations**: PO operations complete even if budget updates fail (graceful degradation)
- **Graceful degradation for draw operations**: Log warnings for missing budget lines, include in API response, but don't fail operations

### Phase 44 Decisions

- **0.01 tolerance for allocation sum validation**: Handles floating point rounding in amount comparisons
- **Separate NO_ALLOCATIONS and ALLOCATION_MISMATCH errors**: Clearer UX for different validation failures

### Pending Todos

None

### Blockers/Concerns

None

## Session Continuity

Last session: 2026-01-19T17:21:47Z
Stopped at: Completed 44-02-PLAN.md (Allocation Sum Validation)
Resume file: None

## Next Actions

1. Execute 44-01-PLAN.md (Allocation cleanup on denied/deleted)
2. Execute 44-03-PLAN.md (Transaction wrapping)
3. Execute 44-04-PLAN.md (Billed_amount recalculation)
4. Continue v1.7 milestone

## Research

- Audit findings from today's comprehensive system review
